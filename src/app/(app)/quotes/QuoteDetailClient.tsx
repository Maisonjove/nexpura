"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, CheckCircle, Download, Gem, Hammer } from "lucide-react";
import { format } from "date-fns";
import { convertQuoteToInvoice, convertQuoteToBespoke, convertQuoteToRepair } from "./actions-server";

interface Quote {
  id: string;
  tenant_id: string;
  customer_id: string;
  quote_number: string | null;
  items: { description: string; quantity: number; unit_price: number }[];
  total_amount: number;
  status: string;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  customers?: {
    full_name: string | null;
    email: string | null;
  };
}
import { emailQuote } from "./emailQuote";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";
import logger from "@/lib/logger";

interface Props {
  quote: Quote;
}

type ConfirmAction = "invoice" | "bespoke" | "repair" | "email" | null;

function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <h3 className="font-bold text-stone-900 text-lg mb-2">{title}</h3>
        <p className="text-sm text-stone-500 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium bg-nexpura-charcoal text-white rounded-xl hover:bg-[#7a6447] transition-colors disabled:opacity-50"
          >
            {loading ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QuoteDetailClient({ quote }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  // convertQuoteTo* return `{ id?: string; error?: string }`. Pre-fix the
  // client awaited the whole object and used it as the `:id` URL segment,
  // producing `/invoices/[object%20Object]` for every successful convert
  // even though the server-side row lands fine. Destructure properly and
  // surface server errors via toast.
  async function handleConvert() {
    setLoading(true);
    setConfirmAction(null);
    try {
      const result = await convertQuoteToInvoice(quote.id);
      if (result.error || !result.id) {
        toast.error(result.error || "Failed to convert quote");
        return;
      }
      router.push(`/invoices/${result.id}`);
    } catch (err) {
      logger.error(err);
      toast.error("Failed to convert quote");
    } finally {
      setLoading(false);
    }
  }

  async function handleConvertToBespoke() {
    setLoading(true);
    setConfirmAction(null);
    try {
      const result = await convertQuoteToBespoke(quote.id);
      if (result.error || !result.id) {
        toast.error(result.error || "Failed to convert quote to bespoke job");
        return;
      }
      toast.success("Converted to Bespoke Job successfully!");
      router.push(`/bespoke/${result.id}`);
    } catch (err) {
      logger.error(err);
      toast.error("Failed to convert quote to bespoke job");
    } finally {
      setLoading(false);
    }
  }

  async function handleConvertToRepair() {
    setLoading(true);
    setConfirmAction(null);
    try {
      const result = await convertQuoteToRepair(quote.id);
      if (result.error || !result.id) {
        toast.error(result.error || "Failed to convert quote to repair job");
        return;
      }
      toast.success("Converted to Repair Job successfully!");
      router.push(`/repairs/${result.id}`);
    } catch (err) {
      logger.error(err);
      toast.error("Failed to convert quote to repair job");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailQuote() {
    setEmailSending(true);
    setConfirmAction(null);
    try {
      const result = await emailQuote(quote.id);
      if (result.success) {
        toast.success("Quote emailed successfully!");
      } else {
        toast.error(`Failed to send: ${result.error}`);
      }
    } catch {
      toast.error("Failed to send quote email.");
    } finally {
      setEmailSending(false);
    }
  }

  const confirmConfig: Record<NonNullable<ConfirmAction>, { title: string; message: string; onConfirm: () => void }> = {
    invoice: {
      title: "Convert to Invoice?",
      message: "This will convert the quote to a new invoice. The quote will be marked as converted.",
      onConfirm: handleConvert,
    },
    bespoke: {
      title: "Convert to Bespoke Job?",
      message: "This will create a new Bespoke Job from this quote. The quote will be marked as converted.",
      onConfirm: handleConvertToBespoke,
    },
    repair: {
      title: "Convert to Repair Job?",
      message: "This will create a new Repair Job from this quote. The quote will be marked as converted.",
      onConfirm: handleConvertToRepair,
    },
    email: {
      title: "Email Quote?",
      message: `Send this quote to ${quote.customers?.email ?? "the customer"}?`,
      onConfirm: handleEmailQuote,
    },
  };

  return (
    <>
      {confirmAction && (
        <ConfirmModal
          open={true}
          title={confirmConfig[confirmAction].title}
          message={confirmConfig[confirmAction].message}
          onConfirm={confirmConfig[confirmAction].onConfirm}
          onCancel={() => setConfirmAction(null)}
          loading={loading || emailSending}
        />
      )}
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/quotes" className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors">
          <ArrowLeft size={18} />
          Back to Quotes
        </Link>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (!quote.customers?.email) {
                toast.error("No customer email on file.");
                return;
              }
              setConfirmAction("email");
            }}
            disabled={emailSending}
            className="flex items-center gap-2 px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
          >
            <Send size={18} />
            {emailSending ? "Sending…" : "Email Quote"}
          </button>
          <a
            href={`/api/quote/${quote.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors"
          >
            <Download size={18} />
            Download PDF
          </a>
          {quote.status !== "converted" && (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAction("repair")}
                disabled={loading}
                className="flex items-center gap-2 border border-stone-300 text-stone-700 px-4 py-2 rounded-lg hover:bg-stone-50 transition-all font-medium disabled:opacity-50"
              >
                <Hammer size={18} />
                {loading ? "..." : "Convert to Repair"}
              </button>
              <button
                onClick={() => setConfirmAction("bespoke")}
                disabled={loading}
                className="flex items-center gap-2 border-2 border-stone-900 text-stone-900 px-4 py-2 rounded-lg hover:bg-stone-900 hover:text-white transition-all font-medium disabled:opacity-50"
              >
                <Gem size={18} />
                {loading ? "..." : "Convert to Bespoke"}
              </button>
              <button
                onClick={() => setConfirmAction("invoice")}
                disabled={loading}
                className="flex items-center gap-2 bg-nexpura-charcoal text-white px-4 py-2 rounded-lg hover:bg-nexpura-charcoal-700 transition-colors font-medium shadow-sm disabled:opacity-50"
              >
                <CheckCircle size={18} />
                {loading ? "..." : "Convert to Invoice"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-8 space-y-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-stone-900">QUOTE</h1>
              <p className="text-stone-500 font-mono mt-1">{quote.quote_number || quote.id.slice(0, 8)}</p>
            </div>
            <div className="text-right">
              <StatusBadge status={quote.status} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Customer</p>
              <p className="text-lg font-bold text-stone-900">{quote.customers?.full_name || "—"}</p>
              <p className="text-stone-500">{quote.customers?.email || "—"}</p>
            </div>
            <div className="text-right">
              <div className="space-y-1">
                <p className="text-sm text-stone-500">
                  <span className="font-semibold text-stone-900">Date:</span> {format(new Date(quote.created_at), "dd MMM yyyy")}
                </p>
                {quote.expires_at && (
                  <p className="text-sm text-stone-500">
                    <span className="font-semibold text-stone-900">Expires:</span> {format(new Date(quote.expires_at), "dd MMM yyyy")}
                  </p>
                )}
              </div>
            </div>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-stone-100">
                <th className="py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Description</th>
                <th className="py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider w-24">Qty</th>
                <th className="py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider w-32">Unit Price</th>
                <th className="py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider w-32">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {quote.items?.map((item, i) => (
                <tr key={i}>
                  <td className="py-4 text-stone-900">{item.description}</td>
                  <td className="py-4 text-right text-stone-600">{item.quantity}</td>
                  <td className="py-4 text-right text-stone-600">${item.unit_price?.toLocaleString()}</td>
                  <td className="py-4 text-right font-medium text-stone-900">${(item.quantity * item.unit_price).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-100">
                <td colSpan={2} className="py-6 pt-12">
                  {quote.notes && (
                    <div className="max-w-md">
                      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Notes</p>
                      <p className="text-sm text-stone-600 italic">{quote.notes}</p>
                    </div>
                  )}
                </td>
                <td className="py-6 pt-12 text-right">
                  <div className="space-y-2">
                    <p className="text-stone-500">Subtotal</p>
                    <p className="text-xl font-bold text-stone-900">Total</p>
                  </div>
                </td>
                <td className="py-6 pt-12 text-right">
                  <div className="space-y-2">
                    <p className="text-stone-900">${quote.total_amount?.toLocaleString()}</p>
                    <p className="text-xl font-bold text-amber-700">${quote.total_amount?.toLocaleString()}</p>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="bg-stone-50 px-8 py-4 text-center">
          <p className="text-xs text-stone-400">Thank you for your business. This quote is subject to our standard terms and conditions.</p>
        </div>
      </div>
    </div>
    </>
  );
}
