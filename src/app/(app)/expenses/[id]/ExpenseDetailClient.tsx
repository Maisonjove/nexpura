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
  created_at: string;
}

interface Props {
  expense: Expense;
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

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function ExpenseDetailClient({ expense }: Props) {
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
        </div>

        {expense.notes && (
          <div className="mt-4 pt-4 border-t border-stone-200">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">Notes</p>
            <p className="text-sm text-stone-900/70 whitespace-pre-wrap">{expense.notes}</p>
          </div>
        )}
      </div>

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
