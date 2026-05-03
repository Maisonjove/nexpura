"use client";

import { useState, useEffect } from "react";
// Lazy-load DOMPurify on the client to dodge React #419 from
// jsdom-bundled isomorphic-dompurify under cacheComponents:true.
type Sanitizer = (html: string) => string;
function useDomPurify(): Sanitizer | null {
  const [sanitize, setSanitize] = useState<Sanitizer | null>(null);
  useEffect(() => {
    let alive = true;
    import("isomorphic-dompurify").then(({ default: DP }) => {
      if (alive) setSanitize(() => (s: string) => DP.sanitize(s));
    });
    return () => {
      alive = false;
    };
  }, []);
  return sanitize;
}
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Users,
  Calendar,
  Eye,
  Loader2,
  Check,
} from "lucide-react";
import { createCampaign, getRecipientCount } from "../actions";

interface Segment {
  id: string;
  name: string;
  customer_count: number;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  template_type: string | null;
}

interface Props {
  segments: Segment[];
  templates: Template[];
  tags: string[];
  businessName: string;
  campaign?: {
    id: string;
    name: string;
    subject: string;
    body: string | null;
    recipient_type: string;
    recipient_filter: Record<string, unknown>;
    scheduled_at: string | null;
  };
}

export default function CampaignFormClient({
  segments,
  templates,
  tags,
  businessName,
  campaign,
}: Props) {
  const router = useRouter();
  const sanitize = useDomPurify();
  const [loading, setLoading] = useState(false);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    name: campaign?.name || "",
    subject: campaign?.subject || "",
    body: campaign?.body || "",
    recipient_type: (campaign?.recipient_type || "all") as
      | "all"
      | "segment"
      | "tags"
      | "manual",
    segment_id: (campaign?.recipient_filter as { segment_id?: string })?.segment_id || "",
    selected_tags: (campaign?.recipient_filter as { tags?: string[] })?.tags || ([] as string[]),
    schedule_type: campaign?.scheduled_at ? "schedule" : "now",
    scheduled_at: campaign?.scheduled_at || "",
  });

  // Fetch recipient count when filter changes
  useEffect(() => {
    async function fetchCount() {
      const filter: { segment_id?: string; tags?: string[] } = {};
      if (formData.recipient_type === "segment" && formData.segment_id) {
        filter.segment_id = formData.segment_id;
      } else if (formData.recipient_type === "tags" && formData.selected_tags.length > 0) {
        filter.tags = formData.selected_tags;
      }

      const result = await getRecipientCount(formData.recipient_type, filter);
      setRecipientCount(result.count);
    }

    fetchCount();
  }, [formData.recipient_type, formData.segment_id, formData.selected_tags]);

  function handleTemplateSelect(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setFormData((prev) => ({
        ...prev,
        subject: template.subject,
        body: template.body,
      }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name || !formData.subject || !formData.body) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);

    const data = {
      name: formData.name,
      subject: formData.subject,
      body: formData.body,
      recipient_type: formData.recipient_type,
      recipient_filter: {
        segment_id: formData.recipient_type === "segment" ? formData.segment_id : undefined,
        tags: formData.recipient_type === "tags" ? formData.selected_tags : undefined,
      },
      scheduled_at:
        formData.schedule_type === "schedule" && formData.scheduled_at
          ? new Date(formData.scheduled_at).toISOString()
          : null,
    };

    const result = await createCampaign(data);

    if (result.error) {
      alert(result.error);
      setLoading(false);
      return;
    }

    router.push("/marketing/campaigns");
    router.refresh();
  }

  function getPreviewHtml() {
    return formData.body
      .replace(/\{\{\s*customer_name\s*\}\}/gi, "John Smith")
      .replace(/\{\{\s*business_name\s*\}\}/gi, businessName);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/marketing/campaigns"
          className="p-2 hover:bg-white/[0.05] rounded-lg text-stone-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {campaign ? "Edit Campaign" : "New Campaign"}
          </h1>
          <p className="text-stone-400 text-sm mt-1">
            Create an email campaign to engage your customers
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Campaign Details */}
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-amber-400" />
            Campaign Details
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1">
                Campaign Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Spring Sale Announcement"
                className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/40"
              />
              <p className="text-xs text-stone-500 mt-1">
                Internal name for this campaign (not shown to customers)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1">
                Email Subject <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="e.g., 🎉 Don't miss our Spring Sale!"
                className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/40"
              />
            </div>

            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1">
                Start from Template (optional)
              </label>
              <select
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/40"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1">
                Email Body <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className={`px-3 py-1 text-sm rounded ${
                    !showPreview
                      ? "bg-amber-600 text-white"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(true)}
                  className={`px-3 py-1 text-sm rounded flex items-center gap-1 ${
                    showPreview
                      ? "bg-amber-600 text-white"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
              </div>
              {showPreview ? (
                <div
                  className="w-full min-h-[300px] p-4 bg-white text-black rounded-lg prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitize ? sanitize(getPreviewHtml()) : "" }}
                />
              ) : (
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
                  placeholder="Write your email content here... Use {{customer_name}} and {{business_name}} for personalization."
                  rows={12}
                  className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/40 font-mono text-sm"
                />
              )}
              <p className="text-xs text-stone-500 mt-1">
                Supports HTML. Variables: {"{{customer_name}}"}, {"{{business_name}}"}
              </p>
            </div>
          </div>
        </div>

        {/* Recipients */}
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Recipients
            {recipientCount !== null && (
              <span className="ml-auto text-sm font-normal text-stone-400">
                {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
              </span>
            )}
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: "all", label: "All Customers" },
                { value: "segment", label: "Segment" },
                { value: "tags", label: "By Tags" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      recipient_type: option.value as "all" | "segment" | "tags",
                    }))
                  }
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    formData.recipient_type === option.value
                      ? "border-amber-500 bg-amber-500/10 text-amber-400"
                      : "border-white/[0.06] text-stone-400 hover:border-white/[0.12]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {formData.recipient_type === "segment" && (
              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Select Segment
                </label>
                <select
                  value={formData.segment_id}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, segment_id: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/40"
                >
                  <option value="">Select a segment...</option>
                  {segments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name} ({segment.customer_count} customers)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.recipient_type === "tags" && (
              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Select Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          selected_tags: prev.selected_tags.includes(tag)
                            ? prev.selected_tags.filter((t) => t !== tag)
                            : [...prev.selected_tags, tag],
                        }));
                      }}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        formData.selected_tags.includes(tag)
                          ? "bg-amber-500 text-white"
                          : "bg-[#252525] text-stone-400 hover:text-white"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  {tags.length === 0 && (
                    <p className="text-stone-500 text-sm">No tags found</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-400" />
            Schedule
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, schedule_type: "now" }))}
                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  formData.schedule_type === "now"
                    ? "border-amber-500 bg-amber-500/10 text-amber-400"
                    : "border-white/[0.06] text-stone-400 hover:border-white/[0.12]"
                }`}
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, schedule_type: "schedule" }))}
                className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                  formData.schedule_type === "schedule"
                    ? "border-amber-500 bg-amber-500/10 text-amber-400"
                    : "border-white/[0.06] text-stone-400 hover:border-white/[0.12]"
                }`}
              >
                Schedule for Later
              </button>
            </div>

            {formData.schedule_type === "schedule" && (
              <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">
                  Send Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, scheduled_at: e.target.value }))
                  }
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/40"
                />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/marketing/campaigns"
            className="px-4 py-2 text-stone-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {formData.schedule_type === "schedule" ? "Schedule Campaign" : "Save Draft"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
