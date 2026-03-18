"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Users,
  Eye,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search,
  X,
} from "lucide-react";
import { sendBulkEmail } from "./actions";
import { getRecipientCount } from "../campaigns/actions";

interface Segment {
  id: string;
  name: string;
  customer_count: number;
}

interface Customer {
  id: string;
  full_name: string | null;
  email: string | null;
  tags: string[] | null;
}

interface Props {
  segments: Segment[];
  customers: Customer[];
  tags: string[];
  businessName: string;
}

export default function BulkEmailClient({ segments, customers, tags, businessName }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    sent?: number;
    failed?: number;
    errors?: string[];
  } | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const [formData, setFormData] = useState({
    subject: "",
    body: "",
    recipient_type: "all" as "all" | "segment" | "tags" | "manual",
    segment_id: "",
    selected_tags: [] as string[],
    selected_customers: [] as string[],
  });

  // Filter customers for manual selection
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 50);
    return customers
      .filter(
        (c) =>
          c.full_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
          c.email?.toLowerCase().includes(customerSearch.toLowerCase())
      )
      .slice(0, 50);
  }, [customers, customerSearch]);

  // Fetch recipient count when filter changes
  useEffect(() => {
    async function fetchCount() {
      if (formData.recipient_type === "manual") {
        setRecipientCount(formData.selected_customers.length);
        return;
      }

      const filter: { segment_id?: string; tags?: string[]; customer_ids?: string[] } = {};
      if (formData.recipient_type === "segment" && formData.segment_id) {
        filter.segment_id = formData.segment_id;
      } else if (formData.recipient_type === "tags" && formData.selected_tags.length > 0) {
        filter.tags = formData.selected_tags;
      }

      const result = await getRecipientCount(formData.recipient_type, filter);
      setRecipientCount(result.count);
    }

    fetchCount();
  }, [formData.recipient_type, formData.segment_id, formData.selected_tags, formData.selected_customers]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.subject || !formData.body) {
      alert("Please fill in subject and body");
      return;
    }

    if (recipientCount === 0) {
      alert("No recipients selected");
      return;
    }

    if (
      !confirm(
        `Send this email to ${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}? This cannot be undone.`
      )
    ) {
      return;
    }

    setLoading(true);
    setResult(null);

    const data = {
      subject: formData.subject,
      body: formData.body,
      recipient_type: formData.recipient_type,
      recipient_filter: {
        segment_id: formData.recipient_type === "segment" ? formData.segment_id : undefined,
        tags: formData.recipient_type === "tags" ? formData.selected_tags : undefined,
        customer_ids: formData.recipient_type === "manual" ? formData.selected_customers : undefined,
      },
    };

    const res = await sendBulkEmail(data);

    if (res.error) {
      setResult({ success: false, errors: [res.error] });
    } else {
      setResult({
        success: true,
        sent: res.sent,
        failed: res.failed,
        errors: res.errors,
      });
    }

    setLoading(false);
  }

  function getPreviewHtml() {
    return formData.body
      .replace(/\{\{\s*customer_name\s*\}\}/gi, "John Smith")
      .replace(/\{\{\s*business_name\s*\}\}/gi, businessName);
  }

  function toggleCustomer(customerId: string) {
    setFormData((prev) => ({
      ...prev,
      selected_customers: prev.selected_customers.includes(customerId)
        ? prev.selected_customers.filter((id) => id !== customerId)
        : [...prev.selected_customers, customerId],
    }));
  }

  if (result?.success) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Emails Sent!</h2>
          <p className="text-stone-300 mb-4">
            Successfully sent {result.sent} email{result.sent !== 1 ? "s" : ""}
            {result.failed ? `. ${result.failed} failed.` : "."}
          </p>
          {result.errors && result.errors.length > 0 && (
            <div className="text-left bg-red-500/10 border border-red-500/20 rounded-lg p-4 mt-4">
              <p className="text-red-400 text-sm font-medium mb-2">Some errors occurred:</p>
              <ul className="text-red-300 text-sm space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center justify-center gap-4 mt-6">
            <Link
              href="/marketing"
              className="px-4 py-2 text-stone-400 hover:text-white transition-colors"
            >
              Back to Marketing
            </Link>
            <button
              onClick={() => {
                setResult(null);
                setFormData({
                  subject: "",
                  body: "",
                  recipient_type: "all",
                  segment_id: "",
                  selected_tags: [],
                  selected_customers: [],
                });
              }}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition-colors"
            >
              Send Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/marketing"
          className="p-2 hover:bg-white/[0.05] rounded-lg text-stone-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Bulk Email</h1>
          <p className="text-stone-400 text-sm mt-1">
            Send a quick one-off email to multiple customers
          </p>
        </div>
      </div>

      {result?.success === false && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Failed to send emails</p>
            <p className="text-red-300 text-sm">{result.errors?.[0]}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
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
                { value: "manual", label: "Select Manually" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      recipient_type: option.value as "all" | "segment" | "tags" | "manual",
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
              <select
                value={formData.segment_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, segment_id: e.target.value }))}
                className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="">Select a segment...</option>
                {segments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name} ({segment.customer_count} customers)
                  </option>
                ))}
              </select>
            )}

            {formData.recipient_type === "tags" && (
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
                {tags.length === 0 && <p className="text-stone-500 text-sm">No tags found</p>}
              </div>
            )}

            {formData.recipient_type === "manual" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type="text"
                    placeholder="Search customers..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                {formData.selected_customers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.selected_customers.map((id) => {
                      const customer = customers.find((c) => c.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-sm"
                        >
                          {customer?.full_name || customer?.email}
                          <button
                            type="button"
                            onClick={() => toggleCustomer(id)}
                            className="hover:text-amber-200"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto border border-white/[0.06] rounded-lg divide-y divide-white/[0.06]">
                  {filteredCustomers.map((customer) => (
                    <label
                      key={customer.id}
                      className="flex items-center gap-3 p-3 hover:bg-white/[0.02] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.selected_customers.includes(customer.id)}
                        onChange={() => toggleCustomer(customer.id)}
                        className="w-4 h-4 rounded border-stone-600 bg-stone-700 text-amber-500 focus:ring-amber-500"
                      />
                      <div>
                        <p className="text-white text-sm">{customer.full_name || "No name"}</p>
                        <p className="text-stone-500 text-xs">{customer.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Email Content */}
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-green-400" />
            Email Content
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-300 mb-1">
                Subject <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="e.g., Important Update from Our Store"
                className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-stone-300">
                  Message <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  {showPreview ? "Edit" : "Preview"}
                </button>
              </div>
              {showPreview ? (
                <div
                  className="w-full min-h-[200px] p-4 bg-white text-black rounded-lg prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                />
              ) : (
                <textarea
                  value={formData.body}
                  onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
                  placeholder="Write your message here..."
                  rows={8}
                  className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              )}
              <p className="text-xs text-stone-500 mt-1">
                Variables: {"{{customer_name}}"}, {"{{business_name}}"}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/marketing"
            className="px-4 py-2 text-stone-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading || recipientCount === 0}
            className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send to {recipientCount || 0} Recipient{recipientCount !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
