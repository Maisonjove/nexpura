"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteExpense } from "../actions";
import ExpenseForm from "../ExpenseForm";

interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  invoice_ref: string | null;
  expense_date: string;
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
}

interface Props {
  expense: Expense;
  auditLogs: AuditLog[];
  userMap: Record<string, { full_name: string | null; email: string | null }>;
}

const CATEGORY_COLOURS: Record<string, string> = {
  stock: "bg-stone-100 text-stone-700",
  rent: "bg-stone-100 text-stone-700",
  utilities: "bg-amber-50 text-amber-700",
  marketing: "bg-stone-50 text-stone-600",
  staffing: "bg-stone-100 text-stone-700",
  equipment: "bg-amber-50 text-amber-700",
  repairs: "bg-red-50 text-red-700",
  other: "bg-stone-900/10 text-stone-900/70",
};

const ACTION_LABEL: Record<string, string> = {
  expense_create: "Expense created",
  expense_update: "Expense edited",
  expense_delete: "Expense deleted",
};

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtAuditWhen(d: string) {
  const date = new Date(d);
  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ExpenseDetailClient({ expense, auditLogs, userMap }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteExpense(expense.id);
    });
  }

  if (editing) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(false)}
            className="text-stone-400 hover:text-stone-900 transition-colors text-sm"
          >
            ← Cancel
          </button>
          <h1 className="font-semibold text-2xl font-semibold text-stone-900">Edit Expense</h1>
        </div>
        <ExpenseForm mode="edit" expense={expense} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1">
            <Link href="/expenses" className="text-stone-400 hover:text-stone-900 transition-colors text-sm">
              ← Expenses
            </Link>
          </div>
          <h1 className="font-semibold text-2xl font-semibold text-stone-900">
            {expense.description}
          </h1>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-stone-200 text-stone-900 rounded-lg hover:bg-stone-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
      </div>

      {/* Details */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Amount</span>
            <span className="font-semibold text-2xl font-semibold text-stone-900">
              {fmtCurrency(expense.amount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Category</span>
            <span
              className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                CATEGORY_COLOURS[expense.category] || "bg-stone-900/10 text-stone-900/70"
              }`}
            >
              {expense.category}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Date</span>
            <span className="text-sm text-stone-900">
              {new Date(expense.expense_date).toLocaleDateString("en-AU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          {expense.invoice_ref && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
                Invoice Ref
              </span>
              <span className="text-sm text-stone-900 font-mono">{expense.invoice_ref}</span>
            </div>
          )}
          {expense.receipt_url && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">Receipt</span>
              <a
                href={expense.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:underline"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                View receipt
              </a>
            </div>
          )}
        </div>

        {expense.notes && (
          <div className="mt-4 pt-4 border-t border-stone-200">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Notes</p>
            <p className="text-sm text-stone-900/70 whitespace-pre-wrap">{expense.notes}</p>
          </div>
        )}
      </div>

      {/* Audit trail */}
      {auditLogs.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-stone-900">Activity</h2>
            <span className="text-xs text-stone-400">{auditLogs.length} event{auditLogs.length === 1 ? "" : "s"}</span>
          </div>
          <ol className="space-y-3">
            {auditLogs.map((log) => {
              const u = log.user_id ? userMap[log.user_id] : null;
              const who = u?.full_name || u?.email || "system";
              const label = ACTION_LABEL[log.action] || log.action.replaceAll("_", " ");
              return (
                <li key={log.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-900">
                      <span className="font-medium">{label}</span>
                      <span className="text-stone-400"> · by {who}</span>
                    </p>
                    <p className="text-xs text-stone-400">{fmtAuditWhen(log.created_at)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Delete */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        {showDelete ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-500">
              Delete this expense permanently? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="bg-red-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isPending ? "Deleting…" : "Confirm Delete"}
              </button>
              <button
                onClick={() => setShowDelete(false)}
                className="bg-white border border-stone-200 text-stone-900 text-sm font-medium px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowDelete(true)}
            className="text-sm text-stone-400 hover:text-red-500 transition-colors"
          >
            Delete expense…
          </button>
        )}
      </div>
    </div>
  );
}
