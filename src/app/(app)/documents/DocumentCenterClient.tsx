"use client";

import { useState } from "react";
import Link from "next/link";
import type { DocumentItem, PassportDoc } from "./page";

interface Props {
  invoices: DocumentItem[];
  quotes: DocumentItem[];
  repairs: DocumentItem[];
  bespoke: DocumentItem[];
  passports: PassportDoc[];
  refunds: DocumentItem[];
}

type DocTab = "invoices" | "quotes" | "repairs" | "bespoke" | "passports" | "refunds";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls =
    s === "active" || s === "paid" || s === "complete" || s === "completed"
      ? "bg-green-50 text-green-700"
      : s === "draft" || s === "pending"
      ? "bg-stone-100 text-stone-500"
      : s === "cancelled" || s === "voided"
      ? "bg-red-50 text-red-500"
      : "bg-[#8B7355]/10 text-[#8B7355]";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {s.replace(/_/g, " ")}
    </span>
  );
}

const DOC_TYPES: { id: DocTab; label: string; emoji: string; pdfPath: string }[] = [
  { id: "invoices", label: "Invoices", emoji: "🧾", pdfPath: "/api/invoice" },
  { id: "quotes", label: "Quotes", emoji: "📋", pdfPath: "/api/quote" },
  { id: "repairs", label: "Repair Tickets", emoji: "🔧", pdfPath: "/api/repair" },
  { id: "bespoke", label: "Bespoke Sheets", emoji: "💎", pdfPath: "/api/bespoke" },
  { id: "passports", label: "Passports", emoji: "🛡️", pdfPath: "/api/passport" },
  { id: "refunds", label: "Refunds", emoji: "↩️", pdfPath: "/api/refund" },
];

function docRef(doc: DocumentItem | PassportDoc): string {
  if ("passport_uid" in doc) return doc.passport_uid;
  const d = doc as DocumentItem;
  return d.invoice_number || d.quote_number || d.repair_number || d.job_number || d.refund_number || doc.id.slice(0, 8);
}

function docTitle(doc: DocumentItem | PassportDoc): string {
  if ("passport_uid" in doc) return doc.title;
  const d = doc as DocumentItem;
  return d.title || (d.customers?.full_name ?? "—");
}

export default function DocumentCenterClient({ invoices, quotes, repairs, bespoke, passports, refunds }: Props) {
  const [activeTab, setActiveTab] = useState<DocTab>("invoices");

  const docMap: Record<DocTab, (DocumentItem | PassportDoc)[]> = {
    invoices,
    quotes,
    repairs,
    bespoke,
    passports,
    refunds,
  };

  const currentDocs = docMap[activeTab];
  const currentType = DOC_TYPES.find((t) => t.id === activeTab)!;

  const totalCount = Object.values(docMap).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Document Center</h1>
          <p className="text-stone-500 text-sm mt-1">Print and download all your business documents in one place</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-xl text-sm text-stone-600 font-medium">
          <span className="text-lg">📄</span>
          {totalCount} documents
        </div>
      </div>

      {/* Quick stat cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {DOC_TYPES.map((type) => {
          const count = docMap[type.id].length;
          return (
            <button
              key={type.id}
              onClick={() => setActiveTab(type.id)}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                activeTab === type.id
                  ? "border-[#8B7355] bg-[#8B7355]/5"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <div className="text-xl mb-1">{type.emoji}</div>
              <div className="text-xs font-medium text-stone-600">{type.label}</div>
              <div className="text-lg font-bold text-stone-900 mt-0.5">{count}</div>
            </button>
          );
        })}
      </div>

      {/* Tab bar */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-stone-200 overflow-x-auto">
          {DOC_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveTab(type.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeTab === type.id
                  ? "border-b-2 border-[#8B7355] text-[#8B7355]"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              <span>{type.emoji}</span>
              {type.label}
              <span className="bg-stone-100 text-stone-500 text-xs rounded-full px-1.5 py-0.5 font-medium">
                {docMap[type.id].length}
              </span>
            </button>
          ))}
        </div>

        {/* Document list */}
        {currentDocs.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <div className="text-4xl mb-3">{currentType.emoji}</div>
            <p className="text-sm">No {currentType.label.toLowerCase()} yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Reference</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    {activeTab === "passports" ? "Item" : "Customer / Item"}
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                  {(activeTab === "invoices" || activeTab === "quotes" || activeTab === "refunds") && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Amount</th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Date</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {currentDocs.map((doc) => {
                  const isPassport = "passport_uid" in doc;
                  const amount = !isPassport
                    ? ((doc as DocumentItem).total ?? (doc as DocumentItem).amount)
                    : null;

                  return (
                    <tr key={doc.id} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-stone-600 font-medium">
                        {docRef(doc)}
                      </td>
                      <td className="px-5 py-3.5 text-stone-900 font-medium max-w-48 truncate">
                        {docTitle(doc)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill status={doc.status} />
                      </td>
                      {(activeTab === "invoices" || activeTab === "quotes" || activeTab === "refunds") && (
                        <td className="px-4 py-3.5 text-stone-900 font-medium">
                          {fmtCurrency(amount)}
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-stone-400 text-xs whitespace-nowrap">
                        {fmtDate(doc.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {/* View link */}
                          <Link
                            href={`/${activeTab === "bespoke" ? "bespoke" : activeTab === "passports" ? "passports" : activeTab === "repairs" ? "repairs" : activeTab === "refunds" ? "refunds" : activeTab}/${doc.id}`}
                            className="text-xs text-stone-500 hover:text-stone-900"
                          >
                            View
                          </Link>
                          {/* PDF download */}
                          <a
                            href={`${currentType.pdfPath}/${doc.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#071A0D] text-white text-xs font-medium rounded-lg hover:bg-stone-800 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            PDF
                          </a>
                          {/* Print button */}
                          <button
                            onClick={() => {
                              const pdfUrl = `${currentType.pdfPath}/${doc.id}/pdf`;
                              window.open(pdfUrl, "_blank");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-200 text-stone-600 text-xs font-medium rounded-lg hover:bg-stone-50 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
        <p className="text-sm text-stone-500">
          💡 <strong>Tip:</strong> PDFs open in a new tab — use your browser&apos;s print dialog to print or save to your device.
          For thermal receipts, configure your printer in{" "}
          <Link href="/settings/printing" className="text-[#8B7355] hover:underline">Printing Settings</Link>.
        </p>
      </div>
    </div>
  );
}
