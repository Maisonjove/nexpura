"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import AuditDiffView from "@/components/AuditDiffView";
import { voidRefund } from "../actions";

interface RefundItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  restock: boolean;
}

interface Refund {
  id: string;
  refund_number: string;
  original_sale_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  reason: string | null;
  refund_method: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
}

interface Props {
  refund: Refund;
  items: RefundItem[];
  auditLogs?: AuditEntry[];
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-blue-50 text-blue-700",
  rejected: "bg-stone-100 text-stone-600",
  completed: "bg-red-50 text-red-700",
  processed: "bg-red-50 text-red-700",
  voided: "bg-stone-100 text-stone-500",
};

export default function RefundDetailClient({ refund, items, auditLogs = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  const isTerminal = refund.status === "voided" || refund.status === "rejected";
  const statusLabel = refund.status === "completed" ? "processed" : refund.status;

  function handleVoid() {
    setError(null);
    startTransition(async () => {
      const result = await voidRefund(refund.id);
      if (result.error) {
        setError(result.error);
        setShowVoidConfirm(false);
      } else {
        setShowVoidConfirm(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {showVoidConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-bold text-stone-900 text-lg mb-2">Void Refund?</h3>
            <p className="text-sm text-stone-500 mb-6">
              This will reverse the inventory restock + store-credit issued by this refund and flip the original sale's status back. Voided refunds remain on record.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowVoidConfirm(false)}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium bg-nexpura-oxblood text-white rounded-xl hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {isPending ? "Voiding…" : "Confirm Void"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/refunds" className="text-stone-400 hover:text-stone-900 text-sm transition-colors">← Refunds</Link>
          <h1 className="text-2xl font-semibold text-stone-900 mt-1">{refund.refund_number}</h1>
          {refund.customer_name && <p className="text-stone-500 text-sm mt-0.5">{refund.customer_name}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex text-sm font-medium px-3 py-1 rounded-full capitalize ${STATUS_BADGE[refund.status] || "bg-stone-100"}`}>
            {statusLabel}
          </span>
          <a
            href={`/api/refund/${refund.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white border border-stone-200 text-stone-700 text-sm font-medium px-4 py-2 rounded-lg hover:border-stone-900 hover:text-stone-900 transition-all"
          >
            Download
          </a>
          {!isTerminal && (
            <button
              onClick={() => setShowVoidConfirm(true)}
              disabled={isPending}
              className="flex items-center gap-2 border border-nexpura-oxblood/40 text-nexpura-oxblood text-sm font-medium px-4 py-2 rounded-lg hover:bg-nexpura-oxblood-bg transition-colors disabled:opacity-50"
            >
              Void Refund
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      {isTerminal && (
        <div className="bg-stone-100 border border-stone-200 text-stone-600 text-sm px-4 py-3 rounded-lg italic">
          Refund is {statusLabel} — terminal state, no further actions.
        </div>
      )}

      {/* Link back to original sale */}
      {refund.original_sale_id && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-stone-700">This refund was processed against an original sale</p>
          <Link
            href={`/sales/${refund.original_sale_id}`}
            className="text-sm text-amber-700 font-semibold hover:underline"
          >
            View Original Sale →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-stone-200">
              <h2 className="text-base font-semibold text-stone-900">Refunded Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left text-xs font-semibold text-stone-500 uppercase tracking-wider px-5 py-3">Item</th>
                    <th className="text-center text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Qty</th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Unit Price</th>
                    <th className="text-right text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Total</th>
                    <th className="text-center text-xs font-semibold text-stone-500 uppercase tracking-wider px-4 py-3">Restocked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-3 text-sm text-stone-900">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-center text-stone-500">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-right text-stone-500">{fmtCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-stone-900">{fmtCurrency(item.line_total)}</td>
                      <td className="px-4 py-3 text-center">
                        {item.restock ? (
                          <span className="text-xs text-green-600 font-medium">✓ Yes</span>
                        ) : (
                          <span className="text-xs text-stone-400">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 border-t border-stone-200 bg-stone-50/40 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Subtotal</span>
                <span className="text-stone-900">{fmtCurrency(refund.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Tax</span>
                <span className="text-stone-900">{fmtCurrency(refund.tax_amount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-stone-200 pt-2">
                <span className="text-stone-900">Total Refunded</span>
                <span className="text-lg text-red-600">−{fmtCurrency(refund.total)}</span>
              </div>
            </div>
          </div>

          {refund.notes && (
            <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
              <h2 className="text-base font-semibold text-stone-900 mb-2">Notes</h2>
              <p className="text-sm text-stone-700 whitespace-pre-wrap">{refund.notes}</p>
            </div>
          )}

          {/* Audit Trail */}
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200">
              <h2 className="text-base font-semibold text-stone-900">Audit Trail</h2>
            </div>
            {auditLogs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-stone-400">No audit history yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {/* Cluster-PR item 4 (R5 Finding 5):
                    Each audit entry now expands to show the full
                    AuditDiffView (red/green field-by-field diff over
                    old_data vs new_data). Pre-fix the rows showed only
                    the action label + timestamp — clicks were inert. */}
                {auditLogs.map((log) => {
                  const hasDiff = Boolean(log.old_data || log.new_data);
                  return (
                    <li key={log.id} className="px-5 py-3 text-sm">
                      <details className="group/diff">
                        <summary className={`flex items-baseline justify-between gap-3 ${hasDiff ? "cursor-pointer" : ""}`}>
                          <span className="font-medium text-stone-900 capitalize inline-flex items-center gap-1.5">
                            {hasDiff && (
                              <ChevronDownIcon className="w-3.5 h-3.5 text-stone-400 transition-transform group-open/diff:rotate-180" />
                            )}
                            {log.action.replace(/_/g, " ")}
                            {log.new_data && (log.new_data as { voided?: boolean }).voided && " — voided"}
                          </span>
                          <span className="text-xs text-stone-400">
                            {new Date(log.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </summary>
                        {hasDiff && (
                          <div className="mt-3 bg-stone-50 border border-stone-100 rounded-lg p-3">
                            <AuditDiffView
                              oldData={log.old_data}
                              newData={log.new_data}
                            />
                          </div>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-base font-semibold text-stone-900">Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-400">Date</span>
                <span className="text-stone-900">
                  {new Date(refund.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              {refund.refund_method && (
                <div className="flex justify-between">
                  <span className="text-stone-400">Method</span>
                  <span className="text-stone-900 capitalize">{refund.refund_method}</span>
                </div>
              )}
              {refund.reason && (
                <div>
                  <p className="text-stone-400 mb-1">Reason</p>
                  <p className="text-stone-900">{refund.reason}</p>
                </div>
              )}
              {refund.customer_email && (
                <div className="flex justify-between gap-2">
                  <span className="text-stone-400 shrink-0">Email</span>
                  <span className="text-stone-900 truncate text-right text-xs">{refund.customer_email}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
