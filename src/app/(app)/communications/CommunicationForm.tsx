"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { sendCommunication } from "./actions";

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze";

const selectCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-nexpura-bronze focus:ring-1 focus:ring-nexpura-bronze";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {children}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-900 mb-1">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

interface Template {
  id: string;
  name: string;
  templateType: string;
  subject: string | null;
  body: string;
  variables: string[];
}

interface CustomerOption {
  id: string;
  fullName: string | null;
  email: string | null;
}

interface SegmentOption {
  id: string;
  name: string;
  description: string | null;
  customerCount: number;
}

const VAR_REGEX = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function previewBody(body: string, customer: CustomerOption | undefined, businessName: string) {
  const sample: Record<string, string> = {
    "customer.name": customer?.fullName ?? "Sample Customer",
    "customer.first_name": (customer?.fullName ?? "Sample").split(" ")[0],
    "customer.email": customer?.email ?? "customer@example.com",
    "business.name": businessName,
  };
  return body.replace(VAR_REGEX, (_m, key) => sample[key] ?? `{{${key}}}`);
}

export default function CommunicationForm({
  templates,
  customers,
  segments,
}: {
  templates: Template[];
  customers: CustomerOption[];
  segments: SegmentOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [type, setType] = useState("email");
  const [recipientMode, setRecipientMode] = useState<"customer" | "segment" | "manual">("customer");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const previewedBody = useMemo(
    () => previewBody(body, selectedCustomer, "Your Jeweller"),
    [body, selectedCustomer],
  );

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setSubject(t.subject ?? "");
    setBody(t.body);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (recipientMode === "segment") {
      // Bulk-segment send isn't routed through this single-row form.
      setError(
        "Segment sends are queued from the Campaigns page. This form only sends to a single recipient.",
      );
      return;
    }

    const formData = new FormData(e.currentTarget);
    if (recipientMode === "customer" && selectedCustomer) {
      formData.set("customer_name", selectedCustomer.fullName ?? "");
      formData.set("customer_email", selectedCustomer.email ?? "");
    }
    formData.set("subject", subject);
    formData.set("body", body);
    formData.set("type", type);

    startTransition(async () => {
      const result = await sendCommunication(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/communications"), 1200);
      }
    });
  }

  if (success) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-10 text-center shadow-sm">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-stone-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-lg text-stone-900">Message sent</p>
        <p className="text-sm text-stone-500 mt-1">Redirecting…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Channel">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="type">Type</FieldLabel>
            <select id="type" value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
              <option value="email">Email</option>
              <option value="sms">SMS (coming soon)</option>
              <option value="whatsapp">WhatsApp (coming soon)</option>
              <option value="note">Internal Note</option>
            </select>
          </div>
          {type !== "note" && templates.length > 0 && (
            <div>
              <FieldLabel htmlFor="template">Template (optional)</FieldLabel>
              <select
                id="template"
                value={selectedTemplateId}
                onChange={(e) => applyTemplate(e.target.value)}
                className={selectCls}
              >
                <option value="">— pick a template to populate body —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Section>

      <Section title="Recipient">
        <div className="flex items-center gap-3 text-xs">
          {(["customer", "segment", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setRecipientMode(m)}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                recipientMode === m
                  ? "bg-amber-50 border-amber-200 text-amber-800 font-semibold"
                  : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {m === "customer" ? "Pick customer" : m === "segment" ? "Segment" : "Manual entry"}
            </button>
          ))}
        </div>

        {recipientMode === "customer" && (
          <div>
            <FieldLabel htmlFor="customer_select">Customer</FieldLabel>
            <select
              id="customer_select"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className={selectCls}
              required
            >
              <option value="">— select a customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {(c.fullName ?? c.email) + (c.email ? ` · ${c.email}` : "")}
                </option>
              ))}
            </select>
            <p className="text-xs text-stone-400 mt-1">
              Showing {customers.length} most recently active customers with an email on file.
            </p>
          </div>
        )}

        {recipientMode === "segment" && (
          <div>
            <FieldLabel htmlFor="segment_select">Segment</FieldLabel>
            <select
              id="segment_select"
              value={selectedSegmentId}
              onChange={(e) => setSelectedSegmentId(e.target.value)}
              className={selectCls}
            >
              <option value="">— select a segment —</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.customerCount} customer{s.customerCount === 1 ? "" : "s"})
                </option>
              ))}
            </select>
            <p className="text-xs text-amber-700 mt-1">
              Bulk segment sends are queued from /customers/campaigns. This form is single-recipient.
            </p>
          </div>
        )}

        {recipientMode === "manual" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="customer_name">Customer name</FieldLabel>
              <input id="customer_name" name="customer_name" type="text" placeholder="e.g. Sarah Johnson" className={inputCls} />
            </div>
            <div>
              <FieldLabel htmlFor="customer_email">Customer email</FieldLabel>
              <input id="customer_email" name="customer_email" type="email" placeholder="sarah@example.com" className={inputCls} />
            </div>
          </div>
        )}
      </Section>

      <Section title="Message">
        {type !== "note" && (
          <div>
            <FieldLabel htmlFor="subject">Subject</FieldLabel>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Your repair is ready"
              className={inputCls}
            />
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-1">
            <FieldLabel htmlFor="body" required>
              {type === "note" ? "Note" : "Message"}
            </FieldLabel>
            {type !== "note" && body.match(VAR_REGEX) && (
              <button
                type="button"
                onClick={() => setShowPreview((p) => !p)}
                className="text-xs text-amber-700 hover:underline"
              >
                {showPreview ? "Hide preview" : "Preview with variables"}
              </button>
            )}
          </div>
          <textarea
            id="body"
            required
            rows={6}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              type === "note"
                ? "Internal note about this customer or interaction…"
                : "Write your message here. Available variables: {{customer.name}}, {{customer.first_name}}, {{customer.email}}, {{business.name}}"
            }
            className={`${inputCls} resize-none font-mono`}
          />
          {showPreview && (
            <div className="mt-2 bg-stone-50 border border-stone-200 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mb-1">Preview</p>
              <p className="text-sm text-stone-800 whitespace-pre-wrap">{previewedBody}</p>
            </div>
          )}
        </div>
      </Section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pb-6">
        <a
          href="/communications"
          className="px-5 py-2.5 text-sm font-medium text-stone-900 bg-white border border-stone-900 rounded-lg hover:bg-stone-900 hover:text-white transition-all"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 text-sm font-medium bg-nexpura-charcoal text-white rounded-lg hover:bg-nexpura-charcoal-700 transition-colors disabled:opacity-50"
        >
          {isPending ? "Sending…" : type === "note" ? "Save Note" : "Send Message"}
        </button>
      </div>
    </form>
  );
}
