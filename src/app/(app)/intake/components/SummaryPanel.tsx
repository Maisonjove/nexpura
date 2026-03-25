"use client";

import type { Customer, JobType, TaxConfig } from "../types";
import { PRIORITIES } from "../constants";

interface SummaryPanelProps {
  jobType: JobType;
  selectedCustomer: Customer | null;
  itemType: string;
  priority: string;
  dueDate: string;
  quoteAmount: number;
  depositAmount: number;
  balanceRemaining: number;
  missingFields: string[];
  taxConfig: TaxConfig;
}

export default function SummaryPanel({
  jobType,
  selectedCustomer,
  itemType,
  priority,
  dueDate,
  quoteAmount,
  depositAmount,
  balanceRemaining,
  missingFields,
  taxConfig,
}: SummaryPanelProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: taxConfig.currency || "AUD",
    }).format(amount);
  };

  return (
    <div className="w-80 flex-shrink-0">
      <div className="sticky top-8">
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-stone-50 px-5 py-4 border-b border-stone-200">
            <h3 className="font-semibold text-stone-900">Job Summary</h3>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            {/* Job Type */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">Job Type</span>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  jobType === "repair"
                    ? "bg-blue-50 text-blue-700"
                    : jobType === "bespoke"
                    ? "bg-purple-50 text-purple-700"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {jobType === "repair"
                  ? "Repair"
                  : jobType === "bespoke"
                  ? "Bespoke"
                  : "Stock Sale"}
              </span>
            </div>

            {/* Customer */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">Customer</span>
              <span className="text-sm font-medium text-stone-900 text-right truncate max-w-[140px]">
                {selectedCustomer?.full_name || "Walk-in"}
              </span>
            </div>

            {/* Item Type */}
            {itemType && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">Item Type</span>
                <span className="text-sm font-medium text-stone-900 capitalize">
                  {itemType}
                </span>
              </div>
            )}

            {/* Priority */}
            {jobType !== "stock" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">Priority</span>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                    PRIORITIES.find((p) => p.value === priority)?.color ||
                    "bg-stone-100 text-stone-600"
                  }`}
                >
                  {priority}
                </span>
              </div>
            )}

            {/* Due Date */}
            {dueDate && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">Due Date</span>
                <span className="text-sm font-medium text-stone-900">
                  {new Date(dueDate).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-stone-100 my-4" />

            {/* Amount */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">Amount</span>
              <span className="text-sm font-semibold text-stone-900">
                {formatCurrency(quoteAmount)}
              </span>
            </div>

            {/* Deposit */}
            {depositAmount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">Deposit</span>
                <span className="text-sm text-stone-700">
                  {formatCurrency(depositAmount)}
                </span>
              </div>
            )}

            {/* Balance */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <span className="text-sm font-medium text-stone-700">Balance</span>
              <span
                className={`text-base font-bold ${
                  balanceRemaining > 0 ? "text-amber-700" : "text-green-600"
                }`}
              >
                {formatCurrency(balanceRemaining)}
              </span>
            </div>

            {/* Missing Fields */}
            {missingFields.length > 0 && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                <p className="text-xs font-medium text-stone-500 mb-2">
                  Required fields:
                </p>
                <ul className="space-y-1">
                  {missingFields.map((field) => (
                    <li
                      key={field}
                      className="text-xs text-red-500 flex items-center gap-1.5"
                    >
                      <span className="w-1 h-1 bg-red-400 rounded-full" />
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
