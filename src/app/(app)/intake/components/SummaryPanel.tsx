"use client";

import type { Customer, JobType, TaxConfig } from "../types";
import { PRIORITIES } from "../constants";
import { primaryBtnCls, secondaryBtnCls, ghostBtnCls } from "./styles";

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
  missingFields,
  taxConfig,
  isWalkIn,
  isFormValid,
  isPending,
  onSubmit,
  onCancel,
  descriptionFilled,
  photosCount,
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

  // Workflow checklist items
  const checklistItems = [
    { label: "Customer linked", done: !!selectedCustomer || isWalkIn },
    { label: "Item type selected", done: !!itemType },
    { label: "Description added", done: descriptionFilled },
    { label: "Priority set", done: !!priority && priority !== "normal" },
    { label: "Due date set", done: !!dueDate },
    { label: "Pricing entered", done: quoteAmount > 0 },
    { label: "Photos attached", done: photosCount > 0 },
    { label: "Ready to save", done: isFormValid },
  ];
  const completedCount = checklistItems.filter((item) => item.done).length;

  // Alerts
  const alerts: string[] = [];
  if (!selectedCustomer && !isWalkIn) alerts.push("No customer linked to this job");
  if (!itemType) alerts.push("Item type not selected");
  if (!dueDate) alerts.push("No due date specified");
  if (quoteAmount <= 0) alerts.push("Pricing not entered");

  // Check icon SVG
  const CheckCircle = ({ done }: { done: boolean }) => (
    <svg className={`w-5 h-5 ${done ? "text-emerald-500" : "text-stone-300"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {done ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      ) : (
        <circle cx="12" cy="12" r="9" strokeWidth={2} />
      )}
    </svg>
  );

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
            Card 2: Financial Snapshot
        ───────────────────────────────────────────────────────────── */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-stone-50 px-5 py-4 border-b border-stone-200">
            <h3 className="font-semibold text-stone-900">Financial Snapshot</h3>
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
              <div className="flex justify-center">
                <span className={`px-3 py-1.5 text-xs font-medium rounded-full ${paymentStatus.color}`}>
                  {paymentStatus.label}
                </span>
              </div>
            )}

            {/* Quote / Deposit Summary */}
            <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 gap-4 text-center">
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
            Card 3: Workflow Checklist
        ───────────────────────────────────────────────────────────── */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-stone-50 px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h3 className="font-semibold text-stone-900">Workflow Checklist</h3>
            <span className="text-xs font-medium text-stone-500">{completedCount}/8 complete</span>
          </div>
          <div className="p-5">
            <ul className="space-y-2">
              {checklistItems.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <CheckCircle done={item.done} />
                  <span className={`text-sm ${item.done ? "text-stone-700" : "text-stone-400"}`}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Card 4: Alerts (only if alerts exist)
        ───────────────────────────────────────────────────────────── */}
        {alerts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="font-semibold text-amber-800">Attention Needed</h3>
            </div>
            <div className="px-5 pb-5">
              <ul className="space-y-1.5">
                {alerts.map((alert) => (
                  <li key={alert} className="text-sm text-amber-700 flex items-center gap-2">
                    <span className="w-1 h-1 bg-amber-500 rounded-full flex-shrink-0" />
                    {alert}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            Card 5: Quick Actions
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

            {/* Secondary Row: Print + Email */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className={secondaryBtnCls}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </span>
              </button>
              <button
                type="button"
                onClick={() => console.log("Email customer")}
                className={secondaryBtnCls}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </span>
              </button>
            </div>

            {/* Ghost buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => console.log("Add follow-up")}
                className={ghostBtnCls}
              >
                + Add Follow-Up
              </button>
              <button
                type="button"
                onClick={onCancel}
                className={`${ghostBtnCls} text-red-500 hover:text-red-600`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
