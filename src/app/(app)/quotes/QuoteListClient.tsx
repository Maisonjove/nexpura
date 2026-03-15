"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Search, Filter, MoreVertical, FileText, Send, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { getQuotes, convertQuoteToInvoice, type Quote } from "./actions";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function QuoteListClient() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    setLoading(true);
    try {
      const data = await getQuotes();
      setQuotes(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConvert(id: string) {
    if (!confirm("Convert this quote to an invoice?")) return;
    try {
      await convertQuoteToInvoice(id);
      loadQuotes();
    } catch (err) {
      console.error(err);
      toast.error("Failed to convert quote");
    }
  }

  const filteredQuotes = quotes.filter(q => 
    q.customers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Quotes</h1>
          <p className="text-stone-500 mt-1">Manage and track your customer quotes.</p>
        </div>
        <Link
          href="/quotes/new"
          className="flex items-center gap-2 bg-[#8B7355] text-white px-4 py-2 rounded-lg hover:bg-[#7a6349] transition-colors font-medium shadow-sm"
        >
          <Plus size={18} />
          New Quote
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input
            type="text"
            placeholder="Search by customer or quote #..."
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B7355]/30 focus:border-[#8B7355]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors w-full sm:w-auto">
            <Filter size={16} />
            Filter
          </button>
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
                      <Link href={`/quotes/${quote.id}`} className="font-mono text-sm text-[#8B7355] hover:underline">
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
                              onClick={() => handleConvert(quote.id)}
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
  );
}
