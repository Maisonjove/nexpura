"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageSquare,
  Users,
  Loader2,
  CheckCircle,
  AlertCircle,
  Search,
  X,
  AlertTriangle,
  Settings,
} from "lucide-react";
import TwilioSetupWizard from "./TwilioSetupWizard";
import { sendBulkSMS } from "./twilio-actions";

interface Segment {
  id: string;
  name: string;
  customer_count: number;
}

interface Customer {
  id: string;
  full_name: string | null;
  phone: string | null;
  tags: string[] | null;
}

interface Props {
  segments: Segment[];
  customers: Customer[];
  tags: string[];
  businessName: string;
  twilioConfigured: boolean;
}

export default function BulkSMSClient({
  segments,
  customers,
  tags,
  businessName,
  twilioConfigured: initialTwilioConfigured,
}: Props) {
  const router = useRouter();
  const [twilioConfigured, setTwilioConfigured] = useState(initialTwilioConfigured);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    sent?: number;
    failed?: number;
    errors?: string[];
  } | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  const [formData, setFormData] = useState({
    message: "",
    recipient_type: "all" as "all" | "segment" | "tags" | "manual",
    segment_id: "",
    selected_tags: [] as string[],
    selected_customers: [] as string[],
  });

  const MAX_SMS_LENGTH = 160;
  const messageLength = formData.message.length;
  const segmentCount = Math.ceil(messageLength / MAX_SMS_LENGTH);

  // Filter customers for manual selection
  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers.slice(0, 50);
    return customers
      .filter(
        (c) =>
          c.full_name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
          c.phone?.includes(customerSearch)
      )
      .slice(0, 50);
  }, [customers, customerSearch]);

  // Calculate recipient count
  const recipientCount = useMemo(() => {
    switch (formData.recipient_type) {
      case "all":
        return customers.length;
      case "segment":
        return segments.find((s) => s.id === formData.segment_id)?.customer_count || 0;
      case "tags":
        // Estimate - customers with any selected tag
        return customers.filter((c) =>
          c.tags?.some((t) => formData.selected_tags.includes(t))
        ).length;
      case "manual":
        return formData.selected_customers.length;
      default:
        return 0;
    }
  }, [formData, customers, segments]);

  function toggleCustomer(customerId: string) {
    setFormData((prev) => ({
      ...prev,
      selected_customers: prev.selected_customers.includes(customerId)
        ? prev.selected_customers.filter((id) => id !== customerId)
        : [...prev.selected_customers, customerId],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.message.trim()) {
      alert("Please enter a message");
      return;
    }

    if (recipientCount === 0) {
      alert("No recipients selected");
      return;
    }

    if (
      !confirm(
        `Send this SMS to ${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}? This will use ${segmentCount} SMS segment${segmentCount !== 1 ? "s" : ""} per recipient.`
      )
    ) {
      return;
    }

    setLoading(true);
    setResult(null);

    // Get the recipients based on selection type
    let recipients: Array<{ phone: string; name?: string; customerId?: string }> = [];

    switch (formData.recipient_type) {
      case "all":
        recipients = customers
          .filter((c) => c.phone)
          .map((c) => ({ phone: c.phone!, name: c.full_name || undefined, customerId: c.id }));
        break;
      case "tags":
        recipients = customers
          .filter((c) => c.phone && c.tags?.some((t) => formData.selected_tags.includes(t)))
          .map((c) => ({ phone: c.phone!, name: c.full_name || undefined, customerId: c.id }));
        break;
      case "manual":
        recipients = customers
          .filter((c) => c.phone && formData.selected_customers.includes(c.id))
          .map((c) => ({ phone: c.phone!, name: c.full_name || undefined, customerId: c.id }));
        break;
    }

    const res = await sendBulkSMS({
      message: formData.message,
      recipients,
    });

    setResult({
      success: res.sent > 0,
      sent: res.sent,
      failed: res.failed,
      errors: res.errors.slice(0, 5),
    });
    setLoading(false);
  }

  if (!twilioConfigured) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/marketing"
            className="p-2 hover:bg-white/[0.05] rounded-lg text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Set Up SMS Messaging</h1>
            <p className="text-stone-400 text-sm mt-1">
              Connect Twilio to send text messages to your customers
            </p>
          </div>
        </div>

        <TwilioSetupWizard onComplete={() => setTwilioConfigured(true)} />
      </div>
    );
  }

  if (result?.success) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">SMS Sent!</h2>
          <p className="text-stone-300 mb-4">
            Successfully sent {result.sent} message{result.sent !== 1 ? "s" : ""}
            {result.failed ? `. ${result.failed} failed.` : "."}
          </p>
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
                  message: "",
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
          <h1 className="text-2xl font-bold text-white">Bulk SMS</h1>
          <p className="text-stone-400 text-sm mt-1">
            Send text messages to multiple customers
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Recipients */}
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Recipients
            <span className="ml-auto text-sm font-normal text-stone-400">
              {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}
            </span>
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
                          {customer?.full_name || customer?.phone}
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
                        <p className="text-stone-500 text-xs">{customer.phone}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Message */}
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            Message
          </h2>

          <div className="space-y-4">
            <div>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                placeholder={`Hi {{customer_name}}, this is ${businessName}...`}
                rows={4}
                maxLength={480} // 3 SMS segments max
                className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-stone-500">
                  Use {"{{customer_name}}"} for personalization
                </p>
                <p
                  className={`text-xs ${
                    messageLength > MAX_SMS_LENGTH
                      ? messageLength > MAX_SMS_LENGTH * 2
                        ? "text-red-400"
                        : "text-amber-400"
                      : "text-stone-500"
                  }`}
                >
                  {messageLength}/{MAX_SMS_LENGTH} characters
                  {segmentCount > 1 && ` (${segmentCount} SMS segments)`}
                </p>
              </div>
            </div>

            {messageLength > MAX_SMS_LENGTH && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-300">
                  Your message will be sent as {segmentCount} SMS segments. This may cost
                  more per recipient.
                </p>
              </div>
            )}
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
            disabled={loading || recipientCount === 0 || !formData.message.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4" />
                Send to {recipientCount} Recipient{recipientCount !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
