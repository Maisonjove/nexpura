"use client";

import { useState, useEffect, useMemo } from "react";
// Lazy-load DOMPurify on the client to avoid React #419
// (cacheComponents-mode prerender flake from jsdom init at import).
// See TemplatesClient for the full root-cause writeup.
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
import Link from "next/link";
import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { sendBulkEmail, sendTestEmail } from "./actions";
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
  const sanitize = useDomPurify();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testedAt, setTestedAt] = useState<{ at: number; to: string } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
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

  async function handleTestSend() {
    setTestError(null);
    if (!formData.subject || !formData.body) {
      setTestError("Subject and body are required for the test send.");
      return;
    }
    setTestLoading(true);
    const r = await sendTestEmail({ subject: formData.subject, body: formData.body });
    setTestLoading(false);
    if (r.error) {
      setTestError(r.error);
    } else {
      setTestedAt({ at: Date.now(), to: r.sentTo ?? "your inbox" });
    }
  }

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

    // Sandbox-before-send: require a test send within the last 30 min,
    // OR an explicit "I know what I'm doing" override. Pre-fix you
    // could blast a typo'd subject line to every customer the moment
    // you finished typing.
    const FRESH_TEST_MS = 30 * 60 * 1000;
    const hasFreshTest = testedAt && Date.now() - testedAt.at < FRESH_TEST_MS;
    if (!hasFreshTest) {
      if (
        !confirm(
          `You haven't sent a test in the last 30 minutes. Master Manual rule 7 says test before bulk. Continue anyway? (Recommended: cancel and click "Send test to me" first.)`
        )
      ) {
        return;
      }
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
      <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
        <div className="max-w-[960px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center max-w-2xl mx-auto">
            <CheckCircleIcon className="w-8 h-8 text-stone-400 mx-auto mb-6" />
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Sent
            </p>
            <h2 className="font-serif text-3xl text-stone-900 tracking-tight mb-4">
              Emails on their way
            </h2>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-8">
              Successfully sent {result.sent} email{result.sent !== 1 ? "s" : ""}
              {result.failed ? `. ${result.failed} failed.` : "."}
            </p>
            {result.errors && result.errors.length > 0 && (
              <div className="text-left border-l-2 border-red-400 pl-4 py-1 mb-8">
                <p className="text-sm text-red-600 font-medium mb-1">Some errors occurred</p>
                <ul className="text-sm text-red-600 space-y-1 leading-relaxed">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/marketing"
                className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900 transition-colors duration-200"
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
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                Send another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[960px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-6 mb-14">
          <div className="flex items-start gap-4">
            <Link
              href="/marketing"
              className="mt-2 text-stone-400 hover:text-nexpura-bronze transition-colors duration-300"
              aria-label="Back to marketing"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Marketing
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-[1.08] tracking-tight">
                Bulk Email
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
                Send a one-off email to a curated group of customers. Test before you send.
              </p>
            </div>
          </div>
        </div>

        {result?.success === false && (
          <div
            role="alert"
            className="border-l-2 border-red-400 pl-4 py-1 mb-8 text-sm text-red-600 leading-relaxed"
          >
            <p className="font-medium">Failed to send emails</p>
            <p className="mt-0.5">{result.errors?.[0]}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 lg:space-y-12">
          {/* Recipients */}
          <section className="bg-white border border-stone-200 rounded-2xl p-8 lg:p-10">
            <div className="flex items-baseline justify-between gap-4 mb-7">
              <div>
                <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                  Step 01
                </p>
                <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                  Recipients
                </h2>
              </div>
              {recipientCount !== null && (
                <span className="text-sm text-stone-500 tabular-nums shrink-0">
                  {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="space-y-5">
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
                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 ${
                      formData.recipient_type === option.value
                        ? "border-nexpura-bronze/40 bg-nexpura-bronze/[0.06] text-stone-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
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
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 bg-white focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
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
                      className={`px-3 py-1 rounded-full text-sm border transition-all duration-200 ${
                        formData.selected_tags.includes(tag)
                          ? "border-nexpura-bronze/40 bg-nexpura-bronze/[0.06] text-stone-900"
                          : "bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
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
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search customers..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                    />
                  </div>

                  {formData.selected_customers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.selected_customers.map((id) => {
                        const customer = customers.find((c) => c.id === id);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-nexpura-bronze/[0.08] text-stone-700 rounded-full text-xs font-medium"
                          >
                            {customer?.full_name || customer?.email}
                            <button
                              type="button"
                              onClick={() => toggleCustomer(id)}
                              className="text-stone-500 hover:text-stone-900 transition-colors"
                              aria-label="Remove"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="max-h-56 overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                    {filteredCustomers.map((customer) => (
                      <label
                        key={customer.id}
                        className="flex items-center gap-3 p-3 hover:bg-stone-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.selected_customers.includes(customer.id)}
                          onChange={() => toggleCustomer(customer.id)}
                          className="w-4 h-4 rounded border-stone-300 text-nexpura-bronze focus:ring-nexpura-bronze/20"
                        />
                        <div className="min-w-0">
                          <p className="text-stone-900 text-sm truncate">{customer.full_name || "No name"}</p>
                          <p className="text-stone-500 text-xs truncate">{customer.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Email Content */}
          <section className="bg-white border border-stone-200 rounded-2xl p-8 lg:p-10">
            <div className="mb-7">
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-2">
                Step 02
              </p>
              <h2 className="font-serif text-2xl text-stone-900 tracking-tight">
                Email Content
              </h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Subject <span className="text-stone-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g., Important update from our store"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-stone-700">
                    Message <span className="text-stone-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-xs text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200"
                  >
                    {showPreview ? "Edit" : "Preview"}
                  </button>
                </div>
                {showPreview ? (
                  <div
                    className="w-full min-h-[200px] p-4 bg-stone-50 border border-stone-200 text-stone-900 rounded-lg prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitize ? sanitize(getPreviewHtml()) : "" }}
                  />
                ) : (
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
                    placeholder="Write your message here..."
                    rows={8}
                    className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 resize-y"
                  />
                )}
                <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                  Variables: {"{{customer_name}}"}, {"{{business_name}}"}
                </p>
              </div>
            </div>
          </section>

          {/* Sandbox test-send banner */}
          {testedAt && (
            <div className="border-l-2 border-stone-300 pl-4 py-1 text-sm text-stone-600 leading-relaxed">
              Test sent to {testedAt.to} at {new Date(testedAt.at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}.
              Bulk send is unlocked for the next 30 minutes.
            </div>
          )}
          {testError && (
            <div role="alert" className="border-l-2 border-red-400 pl-4 py-1 text-sm text-red-600 leading-relaxed">
              {testError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/marketing"
              className="px-4 py-2 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors duration-200"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleTestSend}
              disabled={testLoading || !formData.subject || !formData.body}
              className="inline-flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send this email to your own address as a sandbox test before going to the audience"
            >
              {testLoading ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Sending test...
                </>
              ) : (
                <>Send test to me</>
              )}
            </button>
            <button
              type="submit"
              disabled={loading || recipientCount === 0}
              className="nx-btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="w-4 h-4" />
                  Send to {recipientCount || 0} recipient{recipientCount !== 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
