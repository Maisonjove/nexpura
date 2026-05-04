"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { getQuotesList, convertQuoteToInvoice } from "./actions-server";
import { toast } from "sonner";
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

// Map quote status -> nx-badge-* class. "expired" is computed client-side
// (see filteredQuotes) so we accept it here as a label too.
function getStatusBadgeClass(status: string, expiresAt: string | null, todayStr: string): string {
  const isExpired =
    !!expiresAt &&
    expiresAt < todayStr &&
    !["converted", "rejected", "cancelled"].includes(status);

  if (isExpired) return "nx-badge-danger";
  switch (status) {
    case "accepted":
      return "nx-badge-success";
    case "draft":
    case "sent":
      return "nx-badge-warning";
    case "rejected":
    case "cancelled":
      return "nx-badge-danger";
    case "converted":
    default:
      return "nx-badge-neutral";
  }
}

function getStatusLabel(status: string, expiresAt: string | null, todayStr: string): string {
  const isExpired =
    !!expiresAt &&
    expiresAt < todayStr &&
    !["converted", "rejected", "cancelled"].includes(status);
  if (isExpired) return "Expired";
  if (status === "cancelled") return "Voided";
  return status.charAt(0).toUpperCase() + status.slice(1);
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
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.12)] max-w-md w-full">
            <div className="px-7 pt-7 pb-6">
              <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
                Convert to Invoice?
              </h3>
              <p className="text-sm text-stone-500 leading-relaxed">
                This will convert the quote to a new invoice. The quote will be marked as converted.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-7 py-5 border-t border-stone-200">
              <button
                onClick={() => setConfirmConvertId(null)}
                className="px-4 py-2 rounded-md text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConvert(confirmConvertId)}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                Convert
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-nexpura-ivory min-h-screen">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
          {/* Page Header */}
          <div className="flex items-start justify-between gap-6 mb-14">
            <div>
              <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
                Sales
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl text-stone-900 leading-tight tracking-tight">
                Quotes
              </h1>
              <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
                Manage and track your customer quotes.
              </p>
            </div>
            <Link
              href="/quotes/new"
              className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              New Quote
            </Link>
          </div>

          {/* Search + Status Tabs */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-8">
            <div className="relative mb-5">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by customer or quote #..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatus(tab.value)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-all duration-200 ${
                    activeStatus === tab.value
                      ? "bg-stone-900 text-white"
                      : "text-stone-500 hover:text-stone-900 hover:bg-stone-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quotes List */}
          {loading ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-16 text-center">
              <p className="text-stone-400 text-sm tracking-wide">Loading quotes…</p>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-16 text-center">
              <DocumentTextIcon className="w-8 h-8 text-stone-300 mx-auto mb-6" strokeWidth={1.5} />
              <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
                No quotes found
              </h3>
              <p className="text-stone-500 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                Create your first quote to get started.
              </p>
              <Link
                href="/quotes/new"
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                New Quote
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Column header (desktop only) */}
              <div className="hidden md:grid grid-cols-[1.1fr_1.6fr_1fr_1fr_1fr_1.1fr_auto] gap-4 px-6 py-2 text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
                <div>Quote #</div>
                <div>Customer</div>
                <div>Date</div>
                <div>Expires</div>
                <div>Amount</div>
                <div>Status</div>
                <div className="w-8" />
              </div>

              {filteredQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className="group bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 transition-all duration-400"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1.6fr_1fr_1fr_1fr_1.1fr_auto] gap-4 md:items-center">
                    {/* Quote # */}
                    <div>
                      <p className="md:hidden text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
                        Quote #
                      </p>
                      <Link
                        href={`/quotes/${quote.id}`}
                        className="font-mono text-sm text-nexpura-bronze hover:text-nexpura-bronze-hover transition-colors duration-200"
                      >
                        {quote.quote_number || quote.id.slice(0, 8)}
                      </Link>
                    </div>

                    {/* Customer */}
                    <div>
                      <p className="md:hidden text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
                        Customer
                      </p>
                      <p className="text-sm font-medium text-stone-900">
                        {quote.customers?.full_name || "Unknown Customer"}
                      </p>
                    </div>

                    {/* Date */}
                    <div>
                      <p className="md:hidden text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
                        Date
                      </p>
                      <p className="text-sm text-stone-500 tabular-nums">
                        {format(new Date(quote.created_at), "dd MMM yyyy")}
                      </p>
                    </div>

                    {/* Expires */}
                    <div>
                      <p className="md:hidden text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
                        Expires
                      </p>
                      <p className="text-sm text-stone-500 tabular-nums">
                        {quote.expires_at ? format(new Date(quote.expires_at), "dd MMM yyyy") : "—"}
                      </p>
                    </div>

                    {/* Amount */}
                    <div>
                      <p className="md:hidden text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
                        Amount
                      </p>
                      <p className="text-sm font-semibold text-stone-900 tabular-nums">
                        ${quote.total_amount?.toLocaleString()}
                      </p>
                    </div>

                    {/* Status */}
                    <div>
                      <p className="md:hidden text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1">
                        Status
                      </p>
                      <span className={getStatusBadgeClass(quote.status, quote.expires_at, todayStr)}>
                        {getStatusLabel(quote.status, quote.expires_at, todayStr)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex md:justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="p-2 rounded-md text-stone-400 hover:text-nexpura-bronze hover:bg-stone-100 transition-colors duration-200"
                          aria-label="Actions"
                        >
                          <EllipsisVerticalIcon className="w-4 h-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/quotes/${quote.id}`} className="flex items-center gap-2">
                              <DocumentTextIcon className="w-3.5 h-3.5" /> View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="flex items-center gap-2">
                            <PaperAirplaneIcon className="w-3.5 h-3.5" /> Email Quote
                          </DropdownMenuItem>
                          {quote.status !== "converted" && (
                            <DropdownMenuItem
                              className="flex items-center gap-2 text-nexpura-bronze focus:text-nexpura-bronze-hover"
                              onClick={() => setConfirmConvertId(quote.id)}
                            >
                              <CheckCircleIcon className="w-3.5 h-3.5" /> Convert to Invoice
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
