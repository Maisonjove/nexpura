"use client";

import { useState } from "react";
import Link from "next/link";

interface LabelTemplate {
  id: string;
  name: string;
  label_type: string | null;
  zpl_template: string | null;
  created_at: string;
}

interface Props {
  tenantId: string;
  labelTemplates: LabelTemplate[];
}

const PDF_TYPES = [
  { id: "invoice", label: "Invoice", icon: "📄" },
  { id: "repair_ticket", label: "Repair Ticket", icon: "🔧" },
  { id: "bespoke_sheet", label: "Bespoke Work Sheet", icon: "💎" },
  { id: "passport_cert", label: "Passport Certificate", icon: "🛡️" },
];

type TabId = "labels" | "pdfs" | "history";

export default function DocumentCenterClient({ tenantId: _tenantId, labelTemplates }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("labels");

  function previewPDF(type: string) {
    const urls: Record<string, string> = {
      invoice: "/invoices",
      repair_ticket: "/repairs",
      bespoke_sheet: "/bespoke",
      passport_cert: "/passports",
    };
    window.open(urls[type] ?? "/", "_blank");
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Document Center</h1>
        <p className="text-stone-500 mt-1 text-sm">Manage label templates, PDF document types, and print history.</p>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-stone-200">
          {(["labels", "pdfs", "history"] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-[#8B7355] text-[#8B7355]"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              {tab === "labels" ? "Label Templates" : tab === "pdfs" ? "PDF Templates" : "Print History"}
            </button>
          ))}
        </div>

        {activeTab === "labels" && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-stone-500">ZPL label templates for jewellery tags and price labels.</p>
              <Link href="/settings" className="text-xs text-[#8B7355] hover:underline">
                Manage in Tag Settings →
              </Link>
            </div>
            {labelTemplates.length === 0 ? (
              <div className="py-8 text-center text-sm text-stone-400">No label templates yet</div>
            ) : (
              <div className="divide-y divide-stone-100">
                {labelTemplates.map((t) => (
                  <div key={t.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-stone-900 text-sm">{t.name}</p>
                      {t.label_type && <p className="text-xs text-stone-400 capitalize">{t.label_type}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href="/settings" className="text-xs text-stone-500 hover:text-stone-900 px-2 py-1 rounded">Edit</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "pdfs" && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-stone-500 mb-4">Preview the PDF templates used across the platform.</p>
            {PDF_TYPES.map((pt) => (
              <div key={pt.id} className="flex items-center justify-between p-4 border border-stone-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{pt.icon}</span>
                  <p className="font-medium text-stone-900 text-sm">{pt.label}</p>
                </div>
                <button
                  onClick={() => previewPDF(pt.id)}
                  className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Preview →
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === "history" && (
          <div className="p-5 py-12 text-center text-sm text-stone-400">
            <p>Print history logging will be available in a future update.</p>
          </div>
        )}
      </div>
    </div>
  );
}
