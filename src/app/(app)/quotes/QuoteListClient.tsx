"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { Plus, Search, MoreVertical, FileText, Send, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { getQuotesList, convertQuoteToInvoice } from "./actions-server";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logger from "@/lib/logger";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "converted", label: "Converted" },
  { value: "cancelled", label: "Voided" },
] as const;

interface QuoteItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface Quote {
  id: string;
  tenant_id: string;
  customer_id: string;
  quote_number: string | null;
  items: QuoteItem[];
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

export default function QuoteListClient() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmConvertId, setConfirmConvertId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string>(searchParams.get("status") || "all");

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    setLoading(true);
    try {
      const result = await getQuotesList();
      setQuotes((result.data || []) as Quote[]);
    } catch (err) {
      logger.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConvert(id: string) {
    try {
      await convertQuoteToInvoice(id);
      setConfirmConvertId(null);
      loadQuotes();
    } catch (err) {
      logger.error(err);
      toast.error("Failed to convert quote");
    }
  }

  // Status chip click — instant local-state filter + shallow URL sync so
  // refresh + share-links land on the same tab. Mirrors InvoiceListClient.
  const setStatus = useCallback((status: string) => {
    setActiveStatus(status || "all");
    const sp = new URLSearchParams();
    if (status && status !== "all") sp.set("status", status);
    const next = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
    if (typeof window !== "undefined") window.history.replaceState(null, "", next);
  }, [pathname]);

  // "expired" is computed (expires_at < today AND not converted/rejected/voided),
  // not a stored status. Mirror that predicate client-side.
  const todayStr = new Date().toISOString().split("T")[0];
  const filteredQuotes = useMemo(() => {
    return quotes
      .filter((q) => {
        if (activeStatus === "all") return true;
        if (activeStatus === "expired") {
          return (
            !!q.expires_at &&
            q.expires_at < todayStr &&
            !["converted", "rejected", "cancelled"].includes(q.status)
          );
        }
        return q.status === activeStatus;
      })
      .filter((q) =>
        q.customers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [quotes, activeStatus, searchTerm, todayStr]);

  return (
    <>
      {confirmConvertId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-bold text-stone-900 text-lg mb-2">Convert to Invoice?</h3>
            <p className="text-sm text-stone-500 mb-6">This will convert the quote to a new invoice. The quote will be marked as converted.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmConvertId(null)}
                className="px-4 py-2 text-sm font-medium border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConvert(confirmConvertId)}
                className="px-4 py-2 text-sm font-medium bg-nexpura-charcoal text-white rounded-xl hover:bg-[#7a6447] transition-colors"
              >
                Convert
              </button>
            </div>
          </div>
        </div>
      )}
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Quotes</h1>
          <p className="text-stone-500 mt-1">Manage and track your customer quotes.</p>
        </div>
        <Link
          href="/quotes/new"
          className="flex items-center gap-2 bg-nexpura-charcoal text-white px-4 py-2 rounded-lg hover:bg-nexpura-charcoal-700 transition-colors font-medium shadow-sm"
        >
          <Plus size={18} />
          New Quote
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input
              type="text"
              placeholder="Search by customer or quote #..."
              className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexpura-bronze/30 focus:border-nexpura-bronze"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-1 p-2 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activeStatus === tab.value
                  ? "bg-nexpura-charcoal text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-stone-400">Loading quotes...</div>
        ) : filteredQuotes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={24} className="text-stone-400" />
            </div>
            <p className="text-stone-500 font-medium">No quotes found</p>
            <p className="text-stone-400 text-sm mt-1">Create your first quote to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Quote #</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Expires</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-xs font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredQuotes.map((quote) => (
                  <tr key={quote.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/quotes/${quote.id}`} className="font-mono text-sm text-amber-700 hover:underline">
                        {quote.quote_number || quote.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-stone-900">{quote.customers?.full_name || "Unknown Customer"}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-500">
                      {format(new Date(quote.created_at), "dd MMM yyyy")}
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-500">
                      {quote.expires_at ? format(new Date(quote.expires_at), "dd MMM yyyy") : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-stone-900">
                      ${quote.total_amount?.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={quote.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
                          <MoreVertical size={16} className="text-stone-400" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/quotes/${quote.id}`} className="flex items-center gap-2">
                              <FileText size={14} /> View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center gap-2">
                            <Send size={14} /> Email Quote
                          </DropdownMenuItem>
                          {quote.status !== "converted" && (
                            <DropdownMenuItem 
                              className="flex items-center gap-2 text-green-600 focus:text-green-700"
                              onClick={() => setConfirmConvertId(quote.id)}
                            >
                              <CheckCircle size={14} /> Convert to Invoice
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
