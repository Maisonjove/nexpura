"use client";

import Link from "next/link";

export interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  invoice_ref: string | null;
  expense_date: string;
  created_at: string;
}

interface Props {
  expenses: Expense[];
  monthTotals: Record<string, number>;
  monthTotal: number;
  month: string;
}

const CATEGORY_COLOURS: Record<string, string> = {
  stock: "bg-blue-50 text-blue-700",
  rent: "bg-purple-50 text-purple-700",
  utilities: "bg-amber-50 text-amber-700",
  marketing: "bg-pink-50 text-pink-700",
  staffing: "bg-indigo-50 text-indigo-700",
  equipment: "bg-orange-50 text-orange-700",
  repairs: "bg-red-50 text-red-700",
  other: "bg-forest/10 text-forest/70",
};

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function ExpenseListClient({ expenses, monthTotals, monthTotal, month }: Props) {
  const categories = Object.entries(monthTotals).filter(([, v]) => v > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-fraunces text-2xl font-semibold text-forest">Expenses</h1>
        <Link
          href="/expenses/new"
          className="inline-flex items-center gap-2 bg-sage text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-sage/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Expense
        </Link>
      </div>

      {/* Monthly summary */}
      {monthTotal > 0 && (
        <div className="bg-white border border-platinum rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-fraunces text-base font-semibold text-forest">
              {month} — Totals by Category
            </h2>
            <span className="font-fraunces text-lg font-semibold text-forest">
              {fmtCurrency(monthTotal)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {categories.map(([cat, amount]) => (
              <div key={cat} className="text-center">
                <span
                  className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full capitalize mb-1 ${
                    CATEGORY_COLOURS[cat] || "bg-forest/10 text-forest/70"
                  }`}
                >
                  {cat}
                </span>
                <p className="text-sm font-semibold text-forest">{fmtCurrency(amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      {expenses.length === 0 ? (
        <div className="bg-white border border-platinum rounded-xl p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sage/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h3 className="font-fraunces text-lg font-semibold text-forest">No expenses yet</h3>
          <p className="text-forest/50 mt-1 text-sm">Track your business expenses here.</p>
          <Link
            href="/expenses/new"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-sage text-white text-sm font-medium rounded-lg hover:bg-sage/90 transition-colors"
          >
            Add first expense
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-platinum rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-platinum">
                  <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-5 py-3">
                    Description
                  </th>
                  <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                    Category
                  </th>
                  <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                    Date
                  </th>
                  <th className="text-left text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                    Invoice Ref
                  </th>
                  <th className="text-right text-xs font-semibold text-forest/50 uppercase tracking-wider px-4 py-3">
                    Amount
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-platinum">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-ivory/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-forest">{expense.description}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                          CATEGORY_COLOURS[expense.category] || "bg-forest/10 text-forest/70"
                        }`}
                      >
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-forest/60">
                      {new Date(expense.expense_date).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-forest/60">
                      {expense.invoice_ref || <span className="text-forest/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-forest">
                      {fmtCurrency(expense.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/expenses/${expense.id}`}
                        className="text-xs text-sage font-medium hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
