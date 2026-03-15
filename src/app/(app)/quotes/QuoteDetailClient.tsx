"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, CheckCircle, Download, Gem, Hammer } from "lucide-react";
import { format } from "date-fns";
import { type Quote } from "./actions";
import { convertQuoteToInvoice, convertQuoteToBespoke, convertQuoteToRepair } from "./actions-server";
import { emailQuote } from "./emailQuote";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";

interface Props {
  quote: Quote;
}

export default function QuoteDetailClient({ quote }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  async function handleConvert() {
    if (!confirm("Convert this quote to an invoice?")) return;
    setLoading(true);
    try {
      const invoiceId = await convertQuoteToInvoice(quote.id);
      router.push(`/invoices/${invoiceId}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to convert quote");
    } finally {
      setLoading(false);
    }
  }

  async function handleConvertToBespoke() {
    if (!confirm("Convert this quote to a new Bespoke Job?")) return;
    setLoading(true);
    try {
      const jobId = await convertQuoteToBespoke(quote.id);
      toast.success("Converted to Bespoke Job successfully!");
      router.push(`/bespoke/${jobId}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to convert quote to bespoke job");
    } finally {
      setLoading(false);
    }
  }

  async function handleConvertToRepair() {
    if (!confirm("Convert this quote to a new Repair Job?")) return;
    setLoading(true);
    try {
      const repairId = await convertQuoteToRepair(quote.id);
      toast.success("Converted to Repair Job successfully!");
      router.push(`/repairs/${repairId}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to convert quote to repair job");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/quotes" className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors">
          <ArrowLeft size={18} />
          Back to Quotes
        </Link>
        <div className="flex gap-2">
          <button 
            onClick={async () => {
              if (!quote.customers?.email) {
                toast.error("No customer email on file.");
                return;
              }
              if (!confirm(`Email quote to ${quote.customers.email}?`)) return;
              setEmailSending(true);
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
                onClick={handleConvertToRepair}
                disabled={loading}
                className="flex items-center gap-2 border border-stone-300 text-stone-700 px-4 py-2 rounded-lg hover:bg-stone-50 transition-all font-medium disabled:opacity-50"
              >
                <Hammer size={18} />
                {loading ? "..." : "Convert to Repair"}
              </button>
              <button
                onClick={handleConvertToBespoke}
                disabled={loading}
                className="flex items-center gap-2 border-2 border-stone-900 text-stone-900 px-4 py-2 rounded-lg hover:bg-stone-900 hover:text-white transition-all font-medium disabled:opacity-50"
              >
                <Gem size={18} />
                {loading ? "..." : "Convert to Bespoke"}
              </button>
              <button
                onClick={handleConvert}
                disabled={loading}
                className="flex items-center gap-2 bg-[#8B7355] text-white px-4 py-2 rounded-lg hover:bg-[#7a6349] transition-colors font-medium shadow-sm disabled:opacity-50"
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
                    <p className="text-xl font-bold text-[#8B7355]">${quote.total_amount?.toLocaleString()}</p>
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
  );
}
