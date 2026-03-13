"use client";

import { useState, useTransition } from "react";
import { createExpense, updateExpense } from "./actions";

interface ExpenseData {
  id: string;
  description: string;
  category: string;
  amount: number;
  invoice_ref: string | null;
  expense_date: string;
  notes: string | null;
}

interface Props {
  mode: "create" | "edit";
  expense?: ExpenseData;
}

const CATEGORIES = [
  { value: "stock", label: "Stock" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "marketing", label: "Marketing" },
  { value: "staffing", label: "Staffing" },
  { value: "equipment", label: "Equipment" },
  { value: "repairs", label: "Repairs" },
  { value: "other", label: "Other" },
];

const inputCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 placeholder-stone-300 focus:outline-none focus:border-[#8B7355] focus:ring-1 focus:ring-[#8B7355]";

const selectCls =
  "w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded-lg text-stone-900 focus:outline-none focus:border-[#8B7355] focus:ring-1 focus:ring-[#8B7355]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {children}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-stone-900 mb-1">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

export default function ExpenseForm({ mode, expense }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      if (mode === "create") {
        const result = await createExpense(formData);
        if (result?.error) setError(result.error);
      } else if (expense) {
        const result = await updateExpense(expense.id, formData);
        if (result?.error) setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Expense Details">
        <div>
          <FieldLabel htmlFor="description" required>
            Description
          </FieldLabel>
          <input
            id="description"
            name="description"
            type="text"
            required
            defaultValue={expense?.description || ""}
            placeholder="e.g. Gold bullion purchase, Monthly office rent"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="category" required>
              Category
            </FieldLabel>
            <select
              id="category"
              name="category"
              required
              defaultValue={expense?.category || "other"}
              className={selectCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel htmlFor="amount" required>
              Amount (AUD)
            </FieldLabel>
            <input
              id="amount"
              name="amount"
              type="number"
              required
              min="0.01"
              step="0.01"
              defaultValue={expense?.amount ?? ""}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="expense_date" required>
              Date
            </FieldLabel>
            <input
              id="expense_date"
              name="expense_date"
              type="date"
              required
              defaultValue={expense?.expense_date || today}
              className={inputCls}
            />
          </div>

          <div>
            <FieldLabel htmlFor="invoice_ref">Invoice / Reference</FieldLabel>
            <input
              id="invoice_ref"
              name="invoice_ref"
              type="text"
              defaultValue={expense?.invoice_ref || ""}
              placeholder="INV-001, receipt number…"
              className={inputCls}
            />
          </div>
        </div>
      </Section>

      <Section title="Notes">
        <div>
          <FieldLabel htmlFor="notes">Notes</FieldLabel>
          <textarea
            id="notes"
            name="notes"
            defaultValue={expense?.notes || ""}
            rows={3}
            placeholder="Additional details about this expense…"
            className={`${inputCls} resize-none`}
          />
        </div>
      </Section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pb-6">
        <a
          href="/expenses"
          className="px-5 py-2.5 text-sm font-medium text-stone-900 bg-white border border-stone-900 rounded-lg hover:bg-stone-900 hover:text-white transition-all"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2.5 text-sm font-medium bg-[#8B7355] text-white rounded-lg hover:bg-[#7A6347] transition-colors disabled:opacity-50"
        >
          {isPending
            ? mode === "create"
              ? "Adding…"
              : "Saving…"
            : mode === "create"
            ? "Add Expense"
            : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
