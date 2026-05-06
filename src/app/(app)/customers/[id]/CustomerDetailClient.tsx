"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { archiveCustomer, addCustomerNote, removeFromWishlist, notifyWishlistItem, sendCustomerEmail } from "../actions";
import { format } from "date-fns";
import StatusBadge from "@/components/StatusBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Gem } from "lucide-react";

type Customer = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile: string | null;
  phone: string | null;
  address_line1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  ring_size: string | null;
  wrist_size: string | null;
  gold_preference: string | null;
  spouse_name: string | null;
  spouse_birthday: string | null;
  customer_source: string | null;
  communication_preference: string | null;
  marketing_tags: string[] | null;
  preferred_metal: string | null;
  allergies: string | null;
  birthday: string | null;
  anniversary: string | null;
  tags: string[] | null;
  is_vip: boolean | null;
  notes: string | null;
  customer_since: string | null;
  store_credit: number | null;
  created_at: string;
  updated_at: string | null;
};

type CreditHistory = {
  id: string;
  amount: number;
  balance_after: number;
  reason: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
};

type Repair = {
  id: string;
  repair_number: string | null;
  item_description: string | null;
  stage: string;
  due_date: string | null;
  quoted_price: number | null;
  created_at: string;
};

type BespokeJob = {
  id: string;
  job_number: string | null;
  title: string | null;
  stage: string;
  due_date: string | null;
  quoted_price: number | null;
  created_at: string;
};

type Quote = {
  id: string;
  quote_number: string | null;
  status: string;
  total_amount: number | null;
  expires_at: string | null;
  created_at: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  status: string;
  total: number | null;
  amount_paid: number | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
};

type Passport = {
  id: string;
  passport_uid: string;
  title: string | null;
  jewellery_type: string | null;
  status: string;
  created_at: string;
};

type CustomerCommunication = {
  id: string;
  type: string;
  subject: string | null;
  sent_at: string;
  sent_by: string | null;
  // reference_type / reference_id were referenced here but the columns
  // don't exist on customer_communications (verified against live
  // schema 2026-04-25). Selecting them returned a PG error and the
  // Communications tab silently rendered empty for every customer.
  status?: string | null;
  body?: string | null;
};

type CustomerSale = {
  id: string;
  sale_number: string;
  status: string;
  payment_method: string | null;
  total: number;
  amount_paid: number | null;
  sale_date: string | null;
  created_at: string;
};

const TABS = ["Overview", "Repairs", "Bespoke", "Quotes", "Invoices", "Sales", "Passports", "Wishlist", "Loyalty", "Store Credit", "Communications", "Notes"] as const;
type Tab = (typeof TABS)[number];

function fmt(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | null | undefined, includeYear = true) {
  if (!d) return "—";
  try {
    return new Date(d.includes("T") ? d : d + "T00:00:00").toLocaleDateString("en-AU", {
      day: "numeric", month: "short", ...(includeYear ? { year: "numeric" } : {}),
    });
  } catch { return "—"; }
}

type WishlistItem = {
  id: string;
  inventory_id: string;
  added_at: string;
  notified_at?: string | null;
  inventory?: { name: string; sku: string | null; retail_price: number | null };
};

type LoyaltyTransaction = {
  id: string;
  points: number;
  type: string;
  description: string | null;
  created_at: string;
};

export default function CustomerDetailClient({
  customer,
  creditHistory,
  repairs,
  bespokeJobs,
  quotes,
  invoices,
  passports,
  sales = [],
  communications,
  lifetimeSpend,
  lastVisit,
  readOnly = false,
  wishlistItems = [],
  loyaltyTransactions = [],
}: {
  customer: Customer;
  creditHistory: CreditHistory[];
  repairs: Repair[];
  bespokeJobs: BespokeJob[];
  quotes: Quote[];
  invoices: Invoice[];
  passports: Passport[];
  sales?: CustomerSale[];
  communications: CustomerCommunication[];
  lifetimeSpend: number;
  lastVisit: string | null;
  readOnly?: boolean;
  wishlistItems?: WishlistItem[];
  loyaltyTransactions?: LoyaltyTransaction[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [newNote, setNewNote] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [notes, setNotes] = useState(customer.notes || "");
  const [openComm, setOpenComm] = useState<CustomerCommunication | null>(null);

  // M-06: 1:1 email send modal state.
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<
    | { kind: "idle" }
    | { kind: "sent"; sentTo: string; at: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailResult({ kind: "idle" });
    if (!emailSubject.trim() || !emailBody.trim()) {
      setEmailResult({ kind: "error", message: "Subject and body are required." });
      return;
    }
    setEmailSending(true);
    const result = await sendCustomerEmail(customer.id, emailSubject.trim(), emailBody);
    setEmailSending(false);
    if (result.error) {
      setEmailResult({ kind: "error", message: result.error });
    } else if (result.success && result.sentTo) {
      setEmailResult({ kind: "sent", sentTo: result.sentTo, at: Date.now() });
      // Clear the compose fields after a confirmed send.
      setEmailSubject("");
      setEmailBody("");
      router.refresh();
    } else {
      // Defensive: handler returned neither error nor success+sentTo.
      // Mirror the L-06 contract — never silently report "Sent".
      setEmailResult({
        kind: "error",
        message: "Email provider returned an unexpected response. Try again.",
      });
    }
  }

  async function handleArchive() {
    startTransition(async () => {
      await archiveCustomer(customer.id);
      router.push("/customers");
    });
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNote.trim()) return;
    setNoteSubmitting(true);
    const result = await addCustomerNote(customer.id, newNote.trim());
    if (result.success) {
      const timestamp = new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
      const formattedNote = `[${timestamp}] ${newNote.trim()}`;
      setNotes((prev) => (prev ? `${prev}\n\n${formattedNote}` : formattedNote));
      setNewNote("");
    }
    setNoteSubmitting(false);
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <Link href="/customers" className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors">
          <ChevronLeft size={16} />
          Back to Customers
        </Link>
        {!readOnly && (
          <div className="flex gap-3">
            <button onClick={() => setShowArchiveModal(true)} className="px-4 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-md bg-white hover:bg-red-50 transition-colors duration-200">Archive</button>
            <Link href={`/customers/${customer.id}/edit`} className="nx-btn-primary cursor-pointer">Edit Profile</Link>
          </div>
        )}
      </div>

      {/* Hero Card */}
      <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-20 h-20 rounded-2xl bg-amber-700/5 flex items-center justify-center border border-amber-600/10 text-2xl font-bold text-amber-700 flex-shrink-0">
            {(customer.first_name?.[0] || "?")}{ (customer.last_name?.[0] || "")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-stone-900">{customer.full_name}</h1>
              {customer.is_vip && (
                <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full">VIP</span>
              )}
              {customer.tags?.map(t => (
                <span key={t} className="px-2 py-0.5 bg-stone-100 text-stone-600 text-[10px] font-bold uppercase tracking-wider rounded-md">{t}</span>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-stone-500 mb-4 items-center">
              {customer.email && (
                <span className="flex items-center gap-1.5">
                  ✉ {customer.email}
                  <button
                    type="button"
                    onClick={() => {
                      setEmailResult({ kind: "idle" });
                      setShowEmailModal(true);
                    }}
                    className="ml-1 px-2 py-0.5 text-[11px] font-medium border border-stone-300 text-stone-700 rounded-md hover:border-nexpura-bronze hover:text-nexpura-bronze transition-colors"
                    aria-label={`Send email to ${customer.full_name ?? customer.email}`}
                  >
                    Send email
                  </button>
                </span>
              )}
              {(customer.mobile || customer.phone) && <span className="flex items-center gap-1.5">📱 {customer.mobile || customer.phone}</span>}
              <span className="flex items-center gap-1.5">📅 Customer since {customer.customer_since ? format(new Date(customer.customer_since), "MMM yyyy") : "—"}</span>
            </div>

            {/* Jewellery Preferences — prominent at top */}
            {(customer.preferred_metal || customer.ring_size || customer.allergies || customer.gold_preference || customer.wrist_size) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {customer.preferred_metal && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-nexpura-bronze/10 text-nexpura-bronze border border-nexpura-bronze/20 px-2.5 py-1 rounded-full font-medium">
                    <Gem className="w-3 h-3" strokeWidth={1.5} />
                    {customer.preferred_metal}
                  </span>
                )}
                {customer.gold_preference && (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                    ✨ {customer.gold_preference}
                  </span>
                )}
                {customer.ring_size && (
                  <span className="inline-flex items-center gap-1 text-xs bg-stone-100 text-stone-700 border border-stone-200 px-2.5 py-1 rounded-full font-medium">
                    💍 Ring {customer.ring_size}
                  </span>
                )}
                {customer.wrist_size && (
                  <span className="inline-flex items-center gap-1 text-xs bg-stone-100 text-stone-700 border border-stone-200 px-2.5 py-1 rounded-full font-medium">
                    ⌚ Wrist {customer.wrist_size}
                  </span>
                )}
                {customer.allergies && (
                  <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-medium">
                    ⚠ {customer.allergies}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Stats column */}
          <div className="flex flex-col gap-3 flex-shrink-0 min-w-[160px]">
            <div className="bg-amber-700/5 rounded-2xl p-4 border border-amber-600/10">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">Store Credit</p>
              <p className="text-2xl font-bold text-stone-900">{fmt(customer.store_credit || 0)}</p>
            </div>
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Lifetime Spend</p>
              <p className="text-lg font-bold text-stone-900">{fmt(lifetimeSpend)}</p>
            </div>
            {lastVisit && (
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Last Visit</p>
                <p className="text-sm font-semibold text-stone-700">{fmtDate(lastVisit)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-stone-100 p-1 rounded-2xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"
            }`}
          >
            {tab}
            {tab === "Repairs" && repairs.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-stone-200 text-stone-600 rounded-full px-1.5 py-0.5">{repairs.length}</span>
            )}
            {tab === "Bespoke" && bespokeJobs.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-stone-200 text-stone-600 rounded-full px-1.5 py-0.5">{bespokeJobs.length}</span>
            )}
            {tab === "Quotes" && quotes.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-stone-200 text-stone-600 rounded-full px-1.5 py-0.5">{quotes.length}</span>
            )}
            {tab === "Invoices" && invoices.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-stone-200 text-stone-600 rounded-full px-1.5 py-0.5">{invoices.length}</span>
            )}
            {tab === "Sales" && sales.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-stone-200 text-stone-600 rounded-full px-1.5 py-0.5">{sales.length}</span>
            )}
            {tab === "Wishlist" && wishlistItems.length > 0 && (
              <span className="ml-1.5 text-[10px] bg-stone-200 text-stone-600 rounded-full px-1.5 py-0.5">{wishlistItems.length}</span>
            )}
            {tab === "Loyalty" && (customer as { loyalty_points?: number }).loyalty_points != null && (
              <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5">{(customer as { loyalty_points?: number }).loyalty_points ?? 0}pts</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">

        {/* ── Overview ──────────────────────────────────────────── */}
        {activeTab === "Overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-4">
              <h2 className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 flex items-center gap-2">❤️ Personal & Dates</h2>
              <dl className="grid grid-cols-2 gap-4">
                {[
                  ["Birthday", customer.birthday ? format(new Date(customer.birthday), "dd MMMM") : null],
                  ["Anniversary", customer.anniversary ? format(new Date(customer.anniversary), "dd MMMM") : null],
                  ["Spouse Name", customer.spouse_name],
                  ["Spouse Birthday", customer.spouse_birthday ? format(new Date(customer.spouse_birthday), "dd MMMM") : null],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{label}</dt>
                    <dd className="text-sm text-stone-900 font-medium mt-0.5">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-4">
              <h2 className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 flex items-center gap-2"><Gem className="w-3.5 h-3.5" strokeWidth={1.5} /> Preferences</h2>
              <dl className="grid grid-cols-2 gap-4">
                {[
                  ["Preferred Metal", customer.preferred_metal],
                  ["Gold Preference", customer.gold_preference],
                  ["Ring Size", customer.ring_size],
                  ["Wrist Size", customer.wrist_size],
                  ["Allergies", customer.allergies],
                  ["Comm Preference", customer.communication_preference],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{label}</dt>
                    <dd className="text-sm text-stone-900 font-medium mt-0.5">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-4 md:col-span-2">
              <h2 className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">📍 Contact</h2>
              <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  ["Email", customer.email],
                  ["Mobile", customer.mobile],
                  ["Phone", customer.phone],
                  ["Address", [customer.address_line1, customer.suburb, customer.state, customer.postcode].filter(Boolean).join(", ")],
                  ["Source", customer.customer_source],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{label}</dt>
                    <dd className="text-sm text-stone-900 font-medium mt-0.5">{(value as string) || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}

        {/* ── Repairs ───────────────────────────────────────────── */}
        {activeTab === "Repairs" && (
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h2 className="font-bold text-stone-900">Repair History</h2>
              {!readOnly && <Link href={`/repairs/new?customer_id=${customer.id}`} className="text-sm font-semibold text-amber-700 hover:underline">+ New Repair</Link>}
            </div>
            {repairs.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔧</div>
                <p className="text-stone-500 font-medium">No repairs yet</p>
                <p className="text-stone-400 text-sm mt-1">Repairs booked for this customer will appear here.</p>
                {!readOnly && <Link href={`/repairs/new?customer_id=${customer.id}`} className="mt-4 inline-block text-sm font-medium text-amber-700 hover:underline">Log first repair →</Link>}
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {repairs.map((r) => (
                  <Link key={r.id} href={`/repairs/${r.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-stone-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{r.item_description || "Repair"}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{r.repair_number} · {fmtDate(r.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.quoted_price != null && <span className="text-sm font-medium text-stone-700">{fmt(r.quoted_price)}</span>}
                      <StatusBadge status={r.stage} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Bespoke ───────────────────────────────────────────── */}
        {activeTab === "Bespoke" && (
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h2 className="font-bold text-stone-900">Bespoke Jobs</h2>
              {!readOnly && <Link href={`/bespoke/new?customer_id=${customer.id}`} className="text-sm font-semibold text-amber-700 hover:underline">+ New Job</Link>}
            </div>
            {bespokeJobs.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4"><Gem className="w-6 h-6 text-nexpura-taupe-400" strokeWidth={1.5} /></div>
                <p className="text-stone-500 font-medium">No bespoke jobs yet</p>
                <p className="text-stone-400 text-sm mt-1">Custom jewellery projects for this customer will appear here.</p>
                {!readOnly && <Link href={`/bespoke/new?customer_id=${customer.id}`} className="mt-4 inline-block text-sm font-medium text-amber-700 hover:underline">Start a bespoke job →</Link>}
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {bespokeJobs.map((j) => (
                  <Link key={j.id} href={`/bespoke/${j.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-stone-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{j.title || "Untitled Job"}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{j.job_number} · {fmtDate(j.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {j.quoted_price != null && <span className="text-sm font-medium text-stone-700">{fmt(j.quoted_price)}</span>}
                      <StatusBadge status={j.stage} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Quotes ────────────────────────────────────────────── */}
        {activeTab === "Quotes" && (
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h2 className="font-bold text-stone-900">Quotes</h2>
              {!readOnly && <Link href={`/quotes/new?customer_id=${customer.id}`} className="text-sm font-semibold text-amber-700 hover:underline">+ New Quote</Link>}
            </div>
            {quotes.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">📋</div>
                <p className="text-stone-500 font-medium">No quotes yet</p>
                <p className="text-stone-400 text-sm mt-1">Quotes sent to this customer will appear here.</p>
                {!readOnly && <Link href={`/quotes/new?customer_id=${customer.id}`} className="mt-4 inline-block text-sm font-medium text-amber-700 hover:underline">Create a quote →</Link>}
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {quotes.map((q) => (
                  <Link key={q.id} href={`/quotes/${q.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-stone-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-stone-900 font-mono">{q.quote_number || q.id.slice(0, 8)}</p>
                      <p className="text-xs text-stone-400 mt-0.5">{fmtDate(q.created_at)}{q.expires_at ? ` · Expires ${fmtDate(q.expires_at)}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {q.total_amount != null && <span className="text-sm font-medium text-stone-700">{fmt(q.total_amount)}</span>}
                      <StatusBadge status={q.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Invoices ──────────────────────────────────────────── */}
        {activeTab === "Invoices" && (
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h2 className="font-bold text-stone-900">Invoices</h2>
              {!readOnly && <Link href={`/invoices/new?customer_id=${customer.id}`} className="text-sm font-semibold text-amber-700 hover:underline">+ New Invoice</Link>}
            </div>
            {invoices.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🧾</div>
                <p className="text-stone-500 font-medium">No invoices yet</p>
                <p className="text-stone-400 text-sm mt-1">Invoices issued to this customer will appear here.</p>
                {!readOnly && <Link href={`/invoices/new?customer_id=${customer.id}`} className="mt-4 inline-block text-sm font-medium text-amber-700 hover:underline">Create an invoice →</Link>}
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {invoices.map((inv) => {
                  const balanceDue = Math.max(0, (inv.total || 0) - (inv.amount_paid || 0));
                  return (
                    <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-stone-50 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-stone-900 font-mono">{inv.invoice_number}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {fmtDate(inv.created_at)}
                          {balanceDue > 0 && <span className="text-red-500 ml-1">· {fmt(balanceDue)} due</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-stone-700">{fmt(inv.total || 0)}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Sales ────────────────────────────────────────────── */}
        {activeTab === "Sales" && (
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h2 className="font-bold text-stone-900">Sales</h2>
              {!readOnly && <Link href={`/sales/new?customer_id=${customer.id}`} className="text-sm font-semibold text-amber-700 hover:underline">+ New Sale</Link>}
            </div>
            {sales.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🛍️</div>
                <p className="text-stone-500 font-medium">No sales yet</p>
                <p className="text-stone-400 text-sm mt-1">Sales for this customer will appear here.</p>
                {!readOnly && <Link href={`/sales/new?customer_id=${customer.id}`} className="mt-4 inline-block text-sm font-medium text-amber-700 hover:underline">Create a sale →</Link>}
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {sales.map((s) => {
                  const isLayby = s.status === "layby";
                  const remaining = isLayby ? Math.max(0, s.total - (s.amount_paid ?? 0)) : 0;
                  return (
                    <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-stone-50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-stone-900 font-mono">{s.sale_number}</p>
                          {isLayby && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              Layby
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {fmtDate(s.sale_date || s.created_at)}
                          {isLayby && remaining > 0 && (
                            <span className="text-amber-600 ml-1">· {fmt(remaining)} remaining</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-stone-700">{fmt(s.total)}</span>
                        <span className={`capitalize ${
                          s.status === "paid" ? "nx-badge-success" :
                          s.status === "layby" ? "nx-badge-warning" :
                          s.status === "refunded" ? "nx-badge-danger" :
                          "nx-badge-neutral"
                        }`}>{s.status}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Passports ─────────────────────────────────────────── */}
        {activeTab === "Passports" && (
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h2 className="font-bold text-stone-900">Digital Passports</h2>
              {!readOnly && <Link href={`/passports/new?customer_id=${customer.id}`} className="text-sm font-semibold text-amber-700 hover:underline">+ New Passport</Link>}
            </div>
            {passports.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔏</div>
                <p className="text-stone-500 font-medium">No passports yet</p>
                <p className="text-stone-400 text-sm mt-1">Digital jewellery passports for this customer will appear here.</p>
                {!readOnly && <Link href={`/passports/new?customer_id=${customer.id}`} className="mt-4 inline-block text-sm font-medium text-amber-700 hover:underline">Issue a passport →</Link>}
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {passports.map((p) => (
                  <Link key={p.id} href={`/passports/${p.id}`} className="flex items-center justify-between px-6 py-4 hover:bg-stone-50 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{p.title || "Untitled"}</p>
                      <p className="text-xs text-stone-400 mt-0.5 font-mono">{p.passport_uid} · {p.jewellery_type || "Jewellery"}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Wishlist ──────────────────────────────────────────── */}
        {activeTab === "Wishlist" && (
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between">
              <h2 className="font-bold text-stone-900">Wishlist</h2>
              <span className="text-xs text-stone-400">{wishlistItems.length} item{wishlistItems.length !== 1 ? "s" : ""}</span>
            </div>
            {wishlistItems.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4"><Gem className="w-6 h-6 text-nexpura-taupe-400" strokeWidth={1.5} /></div>
                <p className="text-stone-500 font-medium">No wishlist items yet</p>
                <p className="text-stone-400 text-sm mt-1">Items the customer saves from the catalogue will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {wishlistItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">
                        {item.inventory?.name ?? "Unknown Item"}
                      </p>
                      {item.inventory?.sku && (
                        <p className="text-xs text-stone-400 font-mono mt-0.5">SKU: {item.inventory.sku}</p>
                      )}
                      <p className="text-xs text-stone-400 mt-0.5">
                        Added {fmtDate(item.added_at)}
                        {item.notified_at && (
                          <span className="ml-2 text-emerald-600">· Notified {fmtDate(item.notified_at)}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      {item.inventory?.retail_price != null && (
                        <p className="text-sm font-semibold text-stone-900">{fmt(item.inventory.retail_price)}</p>
                      )}
                      {!readOnly && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await notifyWishlistItem(item.id, customer.id);
                              if (r.error) alert(r.error);
                              else router.refresh();
                            }}
                            disabled={!!item.notified_at}
                            className="text-xs text-amber-700 hover:underline disabled:opacity-50 disabled:no-underline disabled:text-stone-400"
                          >
                            {item.notified_at ? "Notified" : "Notify customer"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm("Remove this item from the wishlist?")) return;
                              const r = await removeFromWishlist(item.id, customer.id);
                              if (r.error) alert(r.error);
                              else router.refresh();
                            }}
                            className="text-xs text-stone-400 hover:text-red-500"
                            aria-label="Remove from wishlist"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Loyalty Points ────────────────────────────────────── */}
        {activeTab === "Loyalty" && (
          <div className="space-y-4">
            {/* Loyalty Summary Card */}
            <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">Loyalty Points</h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-3.5 w-3.5 text-stone-300" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>Loyalty points are earned on every purchase. 500 points = Gold tier. Points can be redeemed for discounts on future sales.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-4xl font-bold text-stone-900">{(customer as { loyalty_points?: number }).loyalty_points ?? 0}</p>
                  <p className="text-sm text-stone-500 mt-1">pts</p>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold ${
                    ((customer as { loyalty_tier?: string }).loyalty_tier ?? "bronze") === "platinum"
                      ? "bg-slate-100 text-slate-700"
                      : ((customer as { loyalty_tier?: string }).loyalty_tier ?? "bronze") === "gold"
                      ? "bg-amber-100 text-amber-700"
                      : ((customer as { loyalty_tier?: string }).loyalty_tier ?? "bronze") === "silver"
                      ? "bg-stone-100 text-stone-600"
                      : "bg-amber-50 text-amber-600"
                  }`}>
                    <span>⭐</span>
                    <span className="capitalize">{(customer as { loyalty_tier?: string }).loyalty_tier ?? "Bronze"}</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-2">Member tier</p>
                </div>
              </div>
              {/* Tier progress */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                  <span>Progress to next tier</span>
                  <span>{Math.min(((customer as { loyalty_points?: number }).loyalty_points ?? 0), 500)} / 500 pts</span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (((customer as { loyalty_points?: number }).loyalty_points ?? 0) / 500) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            {/* Tier Breakdown */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { tier: "Bronze", min: 0, max: 499, color: "bg-amber-50 border-amber-200 text-amber-700" },
                { tier: "Silver", min: 500, max: 1499, color: "bg-stone-50 border-stone-300 text-stone-600" },
                { tier: "Gold", min: 1500, max: 2999, color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
                { tier: "Platinum", min: 3000, max: null, color: "bg-slate-50 border-slate-200 text-slate-700" },
              ].map((t) => {
                const pts = (customer as { loyalty_points?: number }).loyalty_points ?? 0;
                const active = pts >= t.min && (t.max === null || pts <= t.max);
                return (
                  <div key={t.tier} className={`rounded-2xl border p-4 text-center ${active ? t.color : "bg-stone-50 border-stone-200 text-stone-400"}`}>
                    <p className="text-xs font-semibold mb-1">{t.tier}</p>
                    <p className="text-[10px]">{t.min}–{t.max ?? "∞"} pts</p>
                    {active && <p className="text-[10px] font-bold mt-1">Current</p>}
                  </div>
                );
              })}
            </div>
            {/* Transaction history */}
            <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-stone-100">
                <h3 className="font-bold text-stone-900">Points History</h3>
              </div>
              {loyaltyTransactions.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-stone-400 text-sm">No loyalty transactions yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {loyaltyTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-medium text-stone-900 capitalize">{tx.type.replace(/_/g, " ")}</p>
                        {tx.description && <p className="text-xs text-stone-400 mt-0.5">{tx.description}</p>}
                        <p className="text-xs text-stone-400">{fmtDate(tx.created_at)}</p>
                      </div>
                      <p className={`text-sm font-bold ${tx.points > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {tx.points > 0 ? "+" : ""}{tx.points} pts
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Store Credit ──────────────────────────────────────── */}
        {activeTab === "Store Credit" && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-stone-200 p-8 flex items-center justify-between shadow-sm">
              <div>
                <h3 className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-1">Available Balance</h3>
                <p className="text-4xl font-bold text-stone-900">{fmt(customer.store_credit || 0)}</p>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-stone-100">
                <h3 className="font-bold text-stone-900">Transaction History</h3>
              </div>
              {creditHistory.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-stone-400 text-sm">No store credit transactions yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-100">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Date</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Reason</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Amount</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {creditHistory.map((tx) => (
                        <tr key={tx.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-stone-600">{format(new Date(tx.created_at), "dd MMM yyyy HH:mm")}</td>
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-stone-900 capitalize">{tx.reason.replace(/_/g, " ")}</p>
                            {tx.reference_type && <p className="text-[10px] text-stone-400 uppercase font-bold tracking-tight">{tx.reference_type}</p>}
                          </td>
                          <td className={`px-6 py-4 text-sm font-bold text-right ${tx.amount > 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-stone-900 text-right">
                            {fmt(tx.balance_after)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Communications ────────────────────────────────────── */}
        {activeTab === "Communications" && (
          <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-stone-100">
              <h2 className="font-bold text-stone-900">Communication History</h2>
              <p className="text-xs text-stone-400 mt-1">All outbound emails and notifications sent to this customer</p>
            </div>
            {communications.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">📬</div>
                <p className="text-stone-500 font-medium">No communications yet</p>
                <p className="text-stone-400 text-sm mt-1">Emails and notifications sent to this customer will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {communications.map((comm) => {
                  const typeLabels: Record<string, string> = {
                    email_receipt: "Email Receipt",
                    invoice: "Invoice",
                    quote: "Quote",
                    repair_ready: "Repair Ready",
                    stage_update: "Stage Update",
                    whatsapp: "WhatsApp",
                  };
                  const typeIcons: Record<string, string> = {
                    email_receipt: "🧾",
                    invoice: "📄",
                    quote: "📋",
                    repair_ready: "✅",
                    stage_update: "🔄",
                    whatsapp: "💬",
                  };
                  return (
                    <button
                      key={comm.id}
                      type="button"
                      onClick={() => setOpenComm(comm)}
                      className="w-full text-left flex items-start gap-4 px-6 py-4 hover:bg-stone-50 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-lg flex-shrink-0">
                        {typeIcons[comm.type] ?? "📧"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wide text-amber-700">
                            {typeLabels[comm.type] ?? comm.type.replace(/_/g, " ")}
                          </span>
                          {comm.status && (
                            <span className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">
                              · {comm.status}
                            </span>
                          )}
                        </div>
                        {comm.subject && (
                          <p className="text-sm font-medium text-stone-900 mt-0.5 truncate">{comm.subject}</p>
                        )}
                        <p className="text-xs text-stone-400 mt-1">
                          {fmtDate(comm.sent_at)} · {new Date(comm.sent_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Notes ─────────────────────────────────────────────── */}
        {activeTab === "Notes" && (
          <div className="space-y-4">
            {!readOnly && (
              <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
                <h3 className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-4">Add Private Note</h3>
                <form onSubmit={handleAddNote} className="space-y-4">
                  <textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Type a note about this customer..."
                    className="w-full h-32 px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none transition-all duration-200 resize-none"
                  />
                  <div className="flex justify-end">
                    <button disabled={noteSubmitting || !newNote.trim()} className="nx-btn-primary cursor-pointer disabled:opacity-50">
                      Save Note
                    </button>
                  </div>
                </form>
              </div>
            )}
            {notes ? (
              <div className="space-y-3">
                {notes.split("\n\n").filter(Boolean).reverse().map((n, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm text-sm text-stone-700 whitespace-pre-wrap">
                    {n}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-stone-200 p-12 text-center">
                <p className="text-stone-400 text-sm">No notes recorded yet. Add the first note above.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Communication detail modal */}
      {openComm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setOpenComm(null)}>
          <div
            className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  {openComm.type.replace(/_/g, " ")}
                </p>
                <h3 className="font-semibold text-lg text-stone-900 mt-1">{openComm.subject || "(no subject)"}</h3>
                <p className="text-xs text-stone-400 mt-1">
                  {fmtDate(openComm.sent_at)} · {new Date(openComm.sent_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                  {openComm.status && <span className="ml-2">· status: {openComm.status}</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenComm(null)}
                className="text-stone-400 hover:text-stone-900 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {openComm.body ? (
              <div className="bg-stone-50 rounded-lg p-4 text-sm text-stone-700 whitespace-pre-wrap font-mono max-h-[50vh] overflow-y-auto">
                {openComm.body}
              </div>
            ) : (
              <p className="text-sm text-stone-400 italic">No body recorded for this message.</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpenComm(null)}
                className="px-4 py-2 text-sm font-medium border border-stone-200 text-stone-700 bg-white rounded-md hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-xl mx-4">
            <h3 className="font-bold text-lg text-stone-900 mb-2">Archive Customer?</h3>
            <p className="text-sm text-stone-500 mb-6">This customer will be hidden from your active list. You can restore them later.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowArchiveModal(false)} className="px-4 py-2 text-sm font-medium border border-stone-200 text-stone-700 bg-white rounded-md hover:bg-stone-50 hover:border-stone-300 transition-colors duration-200">Cancel</button>
              <button onClick={handleArchive} disabled={isPending} className="px-4 py-2 text-sm font-medium border border-red-200 text-red-600 bg-white rounded-md hover:bg-red-50 transition-colors duration-200 disabled:opacity-50">
                {isPending ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* M-06 — 1:1 customer email modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              if (!emailSending) setShowEmailModal(false);
            }}
          />
          <div className="relative bg-white rounded-2xl border border-stone-200 shadow-xl w-full max-w-lg p-6">
            <h3 className="font-semibold text-lg text-stone-900 mb-1">
              Send email to {customer.full_name ?? "customer"}
            </h3>
            <p className="text-sm text-stone-500 mb-5">
              Goes to <span className="font-mono text-stone-700">{customer.email ?? "—"}</span>.
              Recorded in this customer&apos;s communications panel.
            </p>
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  maxLength={200}
                  disabled={emailSending}
                  placeholder="Following up on your bespoke piece"
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none disabled:bg-stone-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={8}
                  maxLength={50_000}
                  disabled={emailSending}
                  placeholder="Hi there,&#10;&#10;Just wanted to let you know..."
                  className="w-full px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:border-nexpura-bronze focus:ring-2 focus:ring-nexpura-bronze/20 outline-none resize-y disabled:bg-stone-50"
                />
                <p className="text-xs text-stone-400 mt-1">
                  Plain text — line breaks preserved. Sent from your tenant&apos;s configured From address.
                </p>
              </div>

              {emailResult.kind === "error" && (
                <p
                  role="alert"
                  className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                >
                  Send failed: {emailResult.message}
                </p>
              )}
              {emailResult.kind === "sent" && (
                <p
                  role="status"
                  className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2"
                >
                  Sent to <span className="font-mono">{emailResult.sentTo}</span>.
                </p>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  disabled={emailSending}
                  className="px-4 py-2 text-sm font-medium border border-stone-200 rounded-xl hover:bg-stone-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailSending || !emailSubject.trim() || !emailBody.trim()}
                  className="px-4 py-2 text-sm font-medium bg-nexpura-bronze text-white rounded-xl hover:opacity-90 disabled:opacity-50"
                >
                  {emailSending ? "Sending…" : "Send email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronLeft({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}
