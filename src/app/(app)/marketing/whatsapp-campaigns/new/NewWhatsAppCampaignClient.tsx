"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageSquare,
  Users,
  Loader2,
  Search,
  X,
  DollarSign,
  CreditCard,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { createWhatsAppCampaign, createCampaignCheckout } from "../actions";

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
  totalCustomersWithPhone: number;
}

const PRICE_PER_MESSAGE = 0.16; // $0.16 AUD
const MAX_MESSAGE_LENGTH = 1024;

export default function NewWhatsAppCampaignClient({
  segments,
  customers,
  tags,
  businessName,
  totalCustomersWithPhone,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"compose" | "preview" | "checkout">("compose");
  const [error, setError] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    message: "",
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
          c.phone?.includes(customerSearch)
      )
      .slice(0, 50);
  }, [customers, customerSearch]);

  // Calculate recipient count
  const recipientCount = useMemo(() => {
    switch (formData.recipient_type) {
      case "all":
        return totalCustomersWithPhone;
      case "segment":
        return segments.find((s) => s.id === formData.segment_id)?.customer_count || 0;
      case "tags":
        return customers.filter((c) =>
          c.tags?.some((t) => formData.selected_tags.includes(t))
        ).length;
      case "manual":
        return formData.selected_customers.length;
      default:
        return 0;
    }
  }, [formData, customers, segments, totalCustomersWithPhone]);

  const totalCost = recipientCount * PRICE_PER_MESSAGE;

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
    setError(null);

    if (!formData.name.trim()) {
      setError("Please enter a campaign name");
      return;
    }

    if (!formData.message.trim()) {
      setError("Please enter a message");
      return;
    }

    if (recipientCount === 0) {
      setError("No recipients selected");
      return;
    }

    setStep("preview");
  }

  async function handlePayAndSend() {
    setLoading(true);
    setError(null);

    // Build recipient filter
    const recipientFilter: Record<string, unknown> = {};
    if (formData.recipient_type === "segment") {
      recipientFilter.segment_id = formData.segment_id;
    } else if (formData.recipient_type === "tags") {
      recipientFilter.tags = formData.selected_tags;
    } else if (formData.recipient_type === "manual") {
      recipientFilter.customer_ids = formData.selected_customers;
    }

    // Create campaign
    const createResult = await createWhatsAppCampaign({
      name: formData.name,
      message: formData.message,
      recipient_type: formData.recipient_type,
      recipient_filter: recipientFilter,
    });

    if (createResult.error) {
      setError(createResult.error);
      setLoading(false);
      return;
    }

    // Create checkout session
    const checkoutResult = await createCampaignCheckout(createResult.id!);

    if (checkoutResult.error) {
      setError(checkoutResult.error);
      setLoading(false);
      return;
    }

    // Redirect to Stripe Checkout
    if (checkoutResult.checkoutUrl) {
      window.location.href = checkoutResult.checkoutUrl;
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  }

  if (step === "preview") {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => setStep("compose")}
            className="p-2 hover:bg-white/[0.05] rounded-lg text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Review & Pay</h1>
            <p className="text-stone-400 text-sm mt-1">
              Confirm your campaign details and complete payment
            </p>
          </div>
        </div>

        {/* Campaign Summary */}
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg overflow-hidden mb-6">
          <div className="p-6 border-b border-white/[0.06]">
            <h2 className="text-lg font-semibold text-white mb-4">{formData.name}</h2>
            <div className="bg-[#252525] rounded-lg p-4">
              <p className="text-stone-300 whitespace-pre-wrap">{formData.message}</p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Recipients</span>
              <span className="text-white font-medium">
                {recipientCount.toLocaleString()} customers
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Price per message</span>
              <span className="text-white">{formatCurrency(PRICE_PER_MESSAGE)}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-4 flex items-center justify-between">
              <span className="text-lg font-semibold text-white">Total</span>
              <span className="text-2xl font-bold text-green-400">
                {formatCurrency(totalCost)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Notice */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-300 text-sm">
              You'll be redirected to Stripe to complete payment securely. 
              Once payment is confirmed, your messages will be sent automatically.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep("compose")}
            className="px-4 py-2 text-stone-400 hover:text-white transition-colors"
          >
            Back to Edit
          </button>
          <button
            onClick={handlePayAndSend}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Pay {formatCurrency(totalCost)} & Send
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/marketing/whatsapp-campaigns"
          className="p-2 hover:bg-white/[0.05] rounded-lg text-stone-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New WhatsApp Campaign</h1>
          <p className="text-stone-400 text-sm mt-1">
            Create and send marketing messages to your customers
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Campaign Name */}
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-6">
          <label className="block text-sm font-medium text-white mb-2">
            Campaign Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Summer Sale Announcement"
            className="w-full px-4 py-3 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-green-500/40"
          />
        </div>

        {/* Recipients */}
        <div className="bg-[#1A1A1A] border border-white/[0.06] rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Recipients
            <span className="ml-auto text-sm font-normal text-stone-400">
              {recipientCount.toLocaleString()} recipient{recipientCount !== 1 ? "s" : ""}
            </span>
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: "all", label: `All (${totalCustomersWithPhone})` },
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
                      ? "border-green-500 bg-green-500/10 text-green-400"
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
                className="w-full px-3 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/40"
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
                        ? "bg-green-500 text-white"
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
                    className="w-full pl-10 pr-4 py-2 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                  />
                </div>

                {formData.selected_customers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.selected_customers.map((id) => {
                      const customer = customers.find((c) => c.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm"
                        >
                          {customer?.full_name || customer?.phone}
                          <button
                            type="button"
                            onClick={() => toggleCustomer(id)}
                            className="hover:text-green-200"
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
                        className="w-4 h-4 rounded border-stone-600 bg-stone-700 text-green-500 focus:ring-green-500"
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
            <MessageSquare className="w-5 h-5 text-green-400" />
            Message
          </h2>

          <div className="space-y-4">
            <div>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                placeholder={`Hi {{customer_name}}, exciting news from ${businessName}! ...`}
                rows={6}
                maxLength={MAX_MESSAGE_LENGTH}
                className="w-full px-4 py-3 bg-[#252525] border border-white/[0.06] rounded-lg text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-green-500/40 resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-stone-500">
                  Use {"{{customer_name}}"} for personalization
                </p>
                <p className="text-xs text-stone-500">
                  {formData.message.length}/{MAX_MESSAGE_LENGTH} characters
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Preview */}
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-white font-medium">Campaign Cost</p>
                <p className="text-stone-400 text-sm">
                  {recipientCount.toLocaleString()} messages × {formatCurrency(PRICE_PER_MESSAGE)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-green-400">
                {formatCurrency(totalCost)}
              </p>
              <p className="text-xs text-stone-500">AUD incl. GST</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/marketing/whatsapp-campaigns"
            className="px-4 py-2 text-stone-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={recipientCount === 0 || !formData.message.trim() || !formData.name.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            <CheckCircle className="w-5 h-5" />
            Review & Pay {formatCurrency(totalCost)}
          </button>
        </div>
      </form>
    </div>
  );
}
