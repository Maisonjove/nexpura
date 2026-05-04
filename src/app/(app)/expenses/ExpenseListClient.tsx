"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PlusIcon,
  ArrowRightIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

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

// Color restraint per design brief — every category uses the neutral
// badge. The category label itself reads clearly; we don't need
// semantic colour to distinguish "rent" from "utilities".
const CATEGORY_BADGE: Record<string, string> = {
  stock: "nx-badge-neutral",
  rent: "nx-badge-neutral",
  utilities: "nx-badge-neutral",
  marketing: "nx-badge-neutral",
  staffing: "nx-badge-neutral",
  equipment: "nx-badge-neutral",
  repairs: "nx-badge-neutral",
  other: "nx-badge-neutral",
};

function badgeClass(cat: string) {
  return CATEGORY_BADGE[cat] || "nx-badge-neutral";
}

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function ExpenseListClient({ expenses, monthTotals, monthTotal, month }: Props) {
  const categories = useMemo(
    () => Object.entries(monthTotals).filter(([, v]) => v > 0),
    [monthTotals]
  );

  const allCategoryFilters = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => set.add(e.category));
    return ["all", ...Array.from(set)];
  }, [expenses]);

  const [activeCategory, setActiveCategory] = useState<string>("all");

  const visible = useMemo(() => {
    if (activeCategory === "all") return expenses;
    return expenses.filter((e) => e.category === activeCategory);
  }, [expenses, activeCategory]);

  return (
    <div className="bg-nexpura-ivory min-h-screen -mx-6 sm:-mx-10 lg:-mx-16 -my-8 lg:-my-12">
      <div className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16 py-12 lg:py-16">
        {/* Page Header */}
        <div className="mb-14 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-luxury text-stone-500 mb-3">
              Finance
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-stone-900 leading-[1.05] tracking-tight">
              Expenses
            </h1>
            <p className="text-stone-500 mt-4 max-w-xl leading-relaxed">
              Track business expenses by category and review monthly totals.
            </p>
          </div>
          <Link
            href="/expenses/new"
            className="nx-btn-primary inline-flex items-center gap-2 shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            Add Expense
          </Link>
        </div>

        {/* Monthly stat strip — hairline divider strip over ivory, mirroring
            the InvoiceListClient pattern. Bare typography, no card chrome. */}
        {monthTotal > 0 && (
          <div className="mb-14">
            <div className="flex items-baseline justify-between mb-8">
              <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury">
                {month} totals
              </p>
              <p className="font-serif text-4xl text-stone-900 leading-none tabular-nums tracking-tight">
                {fmtCurrency(monthTotal)}
              </p>
            </div>
            {categories.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-8 gap-x-6 sm:divide-x sm:divide-stone-200">
                {categories.map(([cat, amount], idx) => (
                  <div
                    key={cat}
                    className={`sm:px-8 ${idx === 0 ? "sm:first:pl-0" : ""} ${idx === categories.length - 1 ? "sm:last:pr-0" : ""}`}
                  >
                    <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-3 capitalize">
                      {cat}
                    </p>
                    <p className="font-serif text-4xl text-stone-900 leading-none tabular-nums tracking-tight">
                      {fmtCurrency(amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filter pills */}
        {expenses.length > 0 && allCategoryFilters.length > 1 && (
          <div className="flex items-center gap-2 mb-10 overflow-x-auto">
            {allCategoryFilters.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap capitalize transition-all duration-300 ${
                    isActive
                      ? "bg-stone-900 text-white"
                      : "bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900"
                  }`}
                >
                  {cat === "all" ? "All" : cat}
                </button>
              );
            })}
          </div>
        )}

        {/* List */}
        {visible.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-2xl p-14 text-center">
            <BanknotesIcon className="w-8 h-8 text-stone-300 mx-auto mb-5" />
            <h3 className="font-serif text-2xl text-stone-900 tracking-tight mb-3">
              {expenses.length === 0
                ? "No expenses yet"
                : `No ${activeCategory} expenses`}
            </h3>
            <p className="text-stone-500 text-sm max-w-sm mx-auto leading-relaxed mb-7">
              {expenses.length === 0
                ? "Track your business expenses to monitor spend across categories."
                : "Try a different filter to see other expenses."}
            </p>
            {expenses.length === 0 ? (
              <Link
                href="/expenses/new"
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                Add first expense
              </Link>
            ) : (
              <button
                onClick={() => setActiveCategory("all")}
                className="nx-btn-primary inline-flex items-center gap-2"
              >
                View all expenses
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((expense) => (
              <Link
                key={expense.id}
                href={`/expenses/${expense.id}`}
                className="group block bg-white border border-stone-200 rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-stone-300 hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-2.5">
                      <span className={`${badgeClass(expense.category)} capitalize`}>
                        {expense.category}
                      </span>
                      {expense.invoice_ref && (
                        <span className="font-mono text-xs text-stone-400 tabular-nums">
                          {expense.invoice_ref}
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-xl text-stone-900 leading-tight tracking-tight">
                      {expense.description}
                    </h3>
                    <p className="text-xs text-stone-500 mt-3 tabular-nums">
                      {new Date(expense.expense_date).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-[0.6875rem] font-semibold text-stone-400 uppercase tracking-luxury mb-1.5">
                        Amount
                      </p>
                      <p className="font-serif text-2xl text-stone-900 leading-none tracking-tight tabular-nums">
                        {fmtCurrency(expense.amount)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-400 group-hover:text-nexpura-bronze transition-colors duration-300">
                      View
                      <ArrowRightIcon className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
