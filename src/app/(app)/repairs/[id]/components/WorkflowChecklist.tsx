"use client";

import type { Repair, Customer, Invoice, JobAttachment } from "./types";

interface WorkflowChecklistProps {
  repair: Repair;
  customer: Customer | null;
  invoice: Invoice | null;
  attachments: JobAttachment[];
}

interface ChecklistItem {
  label: string;
  done: boolean;
}

export default function WorkflowChecklist({
  repair,
  customer,
  invoice,
  attachments,
}: WorkflowChecklistProps) {
  const items: ChecklistItem[] = [
    { label: "Customer linked", done: customer !== null },
    { label: "Item described", done: !!repair.item_description },
    { label: "Work described", done: !!repair.work_description },
    { label: "Due date set", done: !!repair.due_date },
    { label: "Quote set", done: repair.quoted_price !== null },
    { label: "Invoice generated", done: invoice !== null },
    { label: "Deposit collected", done: repair.deposit_paid },
    { label: "Photos uploaded", done: attachments.length > 0 },
  ];

  const completedCount = items.filter(i => i.done).length;
  const totalCount = items.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Checklist</h2>
        <span className="text-xs font-medium text-stone-600">{completedCount}/{totalCount} complete</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-stone-100 rounded-full mb-4 overflow-hidden">
        <div 
          className="h-full bg-[#8B7355] rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Checklist Items */}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              item.done ? "bg-[#8B7355]" : "bg-stone-100"
            }`}>
              {item.done ? (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </span>
            <span className={`text-sm ${item.done ? "text-stone-700" : "text-stone-400"}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
