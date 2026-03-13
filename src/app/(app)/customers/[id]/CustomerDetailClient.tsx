"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { archiveCustomer, addCustomerNote } from "../actions";

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
  preferred_metal: string | null;
  birthday: string | null;
  anniversary: string | null;
  tags: string[] | null;
  is_vip: boolean | null;
  notes: string | null;
  customer_since: string | null;
  created_at: string;
  updated_at: string | null;
};

const TAG_COLORS: Record<string, string> = {
  VIP: "bg-[#8B7355]/10 text-[#8B7355] border border-[#8B7355]/30",
  Wholesale: "bg-stone-100 text-[#8B7355] border border-[#8B7355]/30",
  Trade: "bg-stone-900/10 text-stone-900 border border-stone-900/30",
  Regular: "bg-stone-200 text-stone-500 border border-stone-200",
};

function getTagColor(tag: string) {
  return TAG_COLORS[tag] || "bg-stone-200 text-stone-500 border border-stone-200";
}

const TABS = ["Overview", "Notes", "Activity"] as const;
type Tab = (typeof TABS)[number];

export default function CustomerDetailClient({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [newNote, setNewNote] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [notes, setNotes] = useState(customer.notes || "");

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  async function handleArchive() {
    startTransition(async () => {
      await archiveCustomer(customer.id);
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

  const infoItem = (label: string, value: string | null | undefined) => (
    <div key={label}>
      <dt className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-stone-900">{value || "—"}</dd>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/customers"
          className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Customers
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchiveModal(true)}
            className="px-4 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            Archive
          </button>
          <Link
            href={`/customers/${customer.id}/edit`}
            className="px-4 py-2 text-sm font-medium bg-[#8B7355] text-white rounded-lg hover:bg-[#7A6347] transition-colors"
          >
            Edit Customer
          </Link>
        </div>
      </div>

      {/* Customer header card */}
      <div className="bg-white rounded-xl border border-stone-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center flex-shrink-0">
            <span className="font-semibold text-2xl font-semibold text-[#8B7355]">
              {(customer.full_name || customer.email || "?")[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-semibold text-2xl font-semibold text-stone-900">
                {customer.full_name || "—"}
              </h1>
              {customer.is_vip && (
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-[#8B7355]/10 text-[#8B7355] border border-[#8B7355]/30 uppercase tracking-wide">
                  ✦ VIP
                </span>
              )}
              {customer.tags?.filter((t) => t !== "VIP").map((tag) => (
                <span key={tag} className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${getTagColor(tag)}`}>
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="text-sm text-[#8B7355] hover:underline">
                  {customer.email}
                </a>
              )}
              {customer.mobile && (
                <a href={`tel:${customer.mobile}`} className="text-sm text-stone-900/70 hover:text-stone-900">
                  {customer.mobile}
                </a>
              )}
              {customer.phone && !customer.mobile && (
                <a href={`tel:${customer.phone}`} className="text-sm text-stone-900/70 hover:text-stone-900">
                  {customer.phone}
                </a>
              )}
              {customer.customer_since && (
                <span className="text-sm text-stone-400">
                  Customer since {formatDate(customer.customer_since)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-200">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-[#8B7355] text-[#8B7355]"
                  : "border-transparent text-stone-500 hover:text-stone-900 hover:border-stone-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === "Overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="font-semibold text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Contact
            </h3>
            <dl className="space-y-3">
              {infoItem("Email", customer.email)}
              {infoItem("Mobile", customer.mobile)}
              {infoItem("Phone", customer.phone)}
            </dl>
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="font-semibold text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Address
            </h3>
            <dl className="space-y-3">
              {infoItem("Street", customer.address_line1)}
              {infoItem("Suburb", customer.suburb)}
              {infoItem("State / Postcode", [customer.state, customer.postcode].filter(Boolean).join(" ") || null)}
              {infoItem("Country", customer.country)}
            </dl>
          </div>

          {/* Jewellery Preferences */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="font-semibold text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Jewellery Preferences
            </h3>
            <dl className="space-y-3">
              {infoItem("Ring Size", customer.ring_size)}
              {infoItem("Preferred Metal", customer.preferred_metal)}
            </dl>
          </div>

          {/* Important Dates */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="font-semibold text-sm font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Important Dates
            </h3>
            <dl className="space-y-3">
              {infoItem("Birthday", formatDate(customer.birthday))}
              {infoItem("Anniversary", formatDate(customer.anniversary))}
            </dl>
          </div>
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === "Notes" && (
        <div className="space-y-4">
          {/* Add note form */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="font-semibold text-sm font-semibold text-stone-900 mb-3">Add Note</h3>
            <form onSubmit={handleAddNote} className="space-y-3">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-[#8B7355] bg-white resize-none"
                placeholder="Add a note about this customer…"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={noteSubmitting || !newNote.trim()}
                  className="px-4 py-2 text-sm font-medium bg-[#8B7355] text-white rounded-lg hover:bg-[#7A6347] transition-colors disabled:opacity-50"
                >
                  {noteSubmitting ? "Saving…" : "Add Note"}
                </button>
              </div>
            </form>
          </div>

          {/* Notes list */}
          {notes ? (
            <div className="space-y-3">
              {notes.split("\n\n").reverse().map((note, i) => {
                const bracketEnd = note.indexOf("] ");
                const match = note.startsWith("[") && bracketEnd > 0
                  ? [note, note.slice(1, bracketEnd), note.slice(bracketEnd + 2)]
                  : null;
                return (
                  <div key={i} className="bg-white rounded-xl border border-stone-200 p-4">
                    {match ? (
                      <>
                        <p className="text-xs text-stone-400 mb-1.5">{match[1]}</p>
                        <p className="text-sm text-stone-900 whitespace-pre-wrap">{match[2]}</p>
                      </>
                    ) : (
                      <p className="text-sm text-stone-900 whitespace-pre-wrap">{note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-stone-200 p-10 text-center">
              <p className="text-stone-400 text-sm">No notes yet. Add one above.</p>
            </div>
          )}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === "Activity" && (
        <div className="bg-white rounded-xl border border-stone-200 p-10 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-stone-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#8B7355]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-base font-semibold text-stone-900">No activity yet</p>
          <p className="text-sm text-stone-500 mt-1">Jobs, repairs and invoices will appear here</p>
        </div>
      )}

      {/* Archive Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl p-6 max-w-sm w-full">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg font-semibold text-stone-900 mb-2">Archive Customer</h3>
            <p className="text-sm text-stone-500 mb-6">
              Are you sure you want to archive <strong>{customer.full_name}</strong>? They will be hidden from your customer list but their data will be preserved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowArchiveModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium border border-stone-900/20 text-stone-900 rounded-lg hover:border-stone-900/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleArchive}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isPending ? "Archiving…" : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
