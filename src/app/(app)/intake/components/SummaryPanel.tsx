"use client";

import type { Customer, JobType, TaxConfig } from "../types";
import { PRIORITIES } from "../constants";
import { primaryBtnCls, ghostBtnCls } from "./styles";

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
  isWalkIn: boolean;
  isFormValid: boolean;
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  descriptionFilled: boolean;
  photosCount: number;
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
  taxConfig,
  isWalkIn,
  isFormValid,
  isPending,
  onSubmit,
  onCancel,
}: SummaryPanelProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: taxConfig.currency || "AUD",
    }).format(amount);
  };

  // Payment status calculation
  const getPaymentStatus = () => {
    if (quoteAmount <= 0) return null;
    if (depositAmount >= quoteAmount) return { label: "Paid in full", color: "bg-emerald-100 text-emerald-700" };
    if (depositAmount > 0) return { label: "Deposit received", color: "bg-blue-100 text-blue-700" };
    return { label: "Awaiting deposit", color: "bg-amber-100 text-amber-700" };
  };
  const paymentStatus = getPaymentStatus();

  return (
    <div className="w-80 flex-shrink-0">
      <div className="sticky top-8 space-y-4">
        {/* ─────────────────────────────────────────────────────────────
            Card 1: Job Overview
        ───────────────────────────────────────────────────────────── */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-stone-50 px-5 py-4 border-b border-stone-200">
            <h3 className="font-semibold text-stone-900">Job Overview</h3>
          </div>
          <div className="p-5 space-y-3">
            {/* Job Type Pill */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">Type</span>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  jobType === "repair"
                    ? "bg-blue-50 text-blue-700"
                    : jobType === "bespoke"
                    ? "bg-purple-50 text-purple-700"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {jobType === "repair" ? "Repair" : jobType === "bespoke" ? "Bespoke" : "Stock Sale"}
              </span>
            </div>

            {/* Customer */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">Customer</span>
              <span className="text-sm font-medium text-stone-900 text-right truncate max-w-[140px]">
                {selectedCustomer?.full_name || (isWalkIn ? "Walk-in" : "—")}
              </span>
            </div>

            {/* Item Type */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">Item</span>
              <span className="text-sm font-medium text-stone-900 capitalize">
                {itemType || "—"}
              </span>
            </div>

            {/* Priority */}
            {jobType !== "stock" && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-stone-500">Priority</span>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                    PRIORITIES.find((p) => p.value === priority)?.color || "bg-stone-100 text-stone-600"
                  }`}
                >
                  {priority || "Normal"}
                </span>
              </div>
            )}

            {/* Due Date */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">Due</span>
              <span className="text-sm font-medium text-stone-900">
                {dueDate
                  ? new Date(dueDate).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Card 2: Financial
        ───────────────────────────────────────────────────────────── */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-stone-50 px-5 py-4 border-b border-stone-200">
            <h3 className="font-semibold text-stone-900">Financial</h3>
          </div>
          <div className="p-5">
            {/* Large Balance Figure */}
            <div className="text-center mb-4">
              <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Balance Due</p>
              <p className={`text-3xl font-bold ${balanceRemaining > 0 ? "text-amber-700" : "text-emerald-600"}`}>
                {formatCurrency(balanceRemaining)}
              </p>
            </div>

            {/* Payment Status Pill */}
            {paymentStatus && (
              <div className="flex justify-center mb-4">
                <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${paymentStatus.color}`}>
                  {paymentStatus.label}
                </span>
              </div>
            )}

            {/* Quote / Deposit Summary */}
            <div className="pt-4 border-t border-stone-100 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-stone-500">Quote</p>
                <p className="text-sm font-semibold text-stone-900">{formatCurrency(quoteAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-500">Deposit</p>
                <p className="text-sm font-semibold text-stone-900">{formatCurrency(depositAmount)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Card 3: Quick Actions
        ───────────────────────────────────────────────────────────── */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-stone-50 px-5 py-4 border-b border-stone-200">
            <h3 className="font-semibold text-stone-900">Quick Actions</h3>
          </div>
          <div className="p-5 space-y-3">
            {/* Primary: Save & Create Job */}
            <button
              type="button"
              onClick={onSubmit}
              disabled={!isFormValid || isPending}
              className={`${primaryBtnCls} w-full flex items-center justify-center gap-2`}
            >
              {isPending && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isPending ? "Creating..." : "Save & Create Job"}
            </button>

            {/* Cancel link */}
            <button
              type="button"
              onClick={onCancel}
              className={`${ghostBtnCls} w-full text-center`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
