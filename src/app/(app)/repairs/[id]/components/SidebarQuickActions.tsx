"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/format-currency";
import type { Repair, Invoice, Customer } from "./types";

interface SidebarQuickActionsProps {
  repair: Repair;
  invoice: Invoice | null;
  customer: Customer | null;
  currency: string;
  balanceDue: number;
  isPending: boolean;
  emailSending: boolean;
  onOpenPaymentModal: (prefill?: number) => void;
  onMarkFullyPaid: () => void;
  onGenerateInvoice: () => void;
  onStageChange: (stage: string) => void;
  onEmailInvoice: () => void;
  onEmailReady: () => void;
}

function fmt(n: number | null | undefined, currency: string) {
  if (n == null) return "—";
  return formatCurrency(n, currency);
}

export default function SidebarQuickActions({
  repair,
  invoice,
  customer,
  currency,
  balanceDue,
  isPending,
  emailSending,
  onOpenPaymentModal,
  onMarkFullyPaid,
  onGenerateInvoice,
  onStageChange,
  onEmailInvoice,
  onEmailReady,
}: SidebarQuickActionsProps) {
  const isTerminal = ["collected", "cancelled"].includes(repair.stage);
  
  // Determine primary contextual action
  let primaryAction: { label: string; onClick: () => void } | null = null;
  
  if (!isTerminal) {
    if (balanceDue > 0 && invoice) {
      primaryAction = { label: "Record Payment", onClick: () => onOpenPaymentModal() };
    } else if (repair.stage === "in_progress") {
      primaryAction = { label: "Mark Ready", onClick: () => onStageChange("ready") };
    } else if (repair.stage === "ready") {
      primaryAction = { label: "Mark Collected", onClick: () => onStageChange("collected") };
    } else if (!invoice) {
      primaryAction = { label: "Generate Invoice", onClick: onGenerateInvoice };
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Quick Actions</h2>
      
      <div className="space-y-2">
        {/* Primary Contextual Action */}
        {primaryAction && (
          <button
            onClick={primaryAction.onClick}
            disabled={isPending}
            className="w-full text-sm font-semibold bg-[#8B7355] hover:bg-[#7A6347] text-white px-4 py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {primaryAction.label}
          </button>
        )}

        {/* Secondary Actions */}
        {!isTerminal && (
          <>
            {/* Stage Change Buttons */}
            {repair.stage !== "ready" && repair.stage !== "collected" && (
              <button
                onClick={() => onStageChange("ready")}
                disabled={isPending}
                className="w-full text-sm font-medium text-stone-700 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Mark Ready for Pickup
              </button>
            )}
            {repair.stage === "ready" && (
              <button
                onClick={() => onStageChange("collected")}
                disabled={isPending}
                className="w-full text-sm font-medium text-stone-700 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Mark Collected
              </button>
            )}
            
            {/* Mark Fully Paid */}
            {balanceDue > 0 && invoice && (
              <button
                onClick={onMarkFullyPaid}
                disabled={isPending}
                className="w-full text-sm font-medium text-stone-700 border border-stone-200 px-4 py-2.5 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Mark Fully Paid ({fmt(balanceDue, currency)})
              </button>
            )}
          </>
        )}

        {/* Document Actions */}
        <div className="border-t border-stone-100 pt-2 mt-2 space-y-2">
          <button 
            onClick={() => window.open(`/print/repair/${repair.id}`, "_blank")} 
            className="w-full text-sm font-medium text-stone-600 border border-stone-200 px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
          >
            🖨️ Print
          </button>
          
          {invoice && (
            <button 
              onClick={onEmailInvoice}
              disabled={emailSending}
              className="w-full text-sm font-medium text-stone-600 border border-stone-200 px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              ✉️ Email Invoice
            </button>
          )}
          
          {repair.stage === "ready" && customer?.email && (
            <button 
              onClick={onEmailReady}
              disabled={emailSending}
              className="w-full text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg hover:bg-amber-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              ✉️ Email Ready
            </button>
          )}

          {invoice && (
            <Link 
              href={`/invoices/${invoice.id}`}
              className="block w-full text-sm font-medium text-stone-600 border border-stone-200 px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors text-center"
            >
              View Invoice
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
