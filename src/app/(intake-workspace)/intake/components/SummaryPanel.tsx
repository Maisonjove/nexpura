"use client";

import { AlertTriangle, ChevronRight, ShieldAlert, CheckCircle2 } from "lucide-react";
import type { Customer, JobType, TaxConfig } from "../types";
import { PRIORITIES } from "../constants";
import type { Step } from "./ProgressIndicator";

// Section 12.8 — Live Job Summary sidebar.
// - Always shows: Type / Customer / Item or Title / Status / Priority /
//   Due / Quote / Deposit / Balance.
// - Alerts panel: missing-required list with click-to-jump links + warnings
//   + sections-complete count.
// - Footer: "Save progress" (secondary) + "Save & Create Job" (primary,
//   charcoal-900, full width). Disabled when required fields missing —
//   tooltip lists what's missing.

export interface MissingField {
  label: string;
  stepIndex: number;
}

interface SummaryPanelProps {
  jobType: JobType;
  selectedCustomer: Customer | null;
  itemType: string;
  jobTitle?: string;
  status?: string;
  priority: string;
  dueDate: string;
  quoteAmount: number;
  depositAmount: number;
  balanceRemaining: number;
  missingFields: MissingField[];
  warnings: string[];
  steps: Step[];
  completedCount: number;
  taxConfig: TaxConfig;
  isWalkIn: boolean;
  isFormValid: boolean;
  isPending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  onSaveDraft?: () => void;
  onJumpToStep: (index: number) => void;
}

export default function SummaryPanel({
  jobType,
  selectedCustomer,
  itemType,
  jobTitle,
  status,
  priority,
  dueDate,
  quoteAmount,
  depositAmount,
  balanceRemaining,
  missingFields,
  warnings,
  steps,
  completedCount,
  taxConfig,
  isWalkIn,
  isFormValid,
  isPending,
  onSubmit,
  onCancel,
  onSaveDraft,
  onJumpToStep,
}: SummaryPanelProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: taxConfig.currency || "AUD",
    }).format(amount);
  };

  const typeLabel = jobType === "repair" ? "Repair" : jobType === "bespoke" ? "Bespoke" : "Stock Sale";

  const customerLabel = selectedCustomer
    ? selectedCustomer.full_name || "Customer"
    : isWalkIn
      ? "Walk-in"
      : "Not selected";
  const customerCls = selectedCustomer
    ? "text-nexpura-charcoal"
    : isWalkIn
      ? "text-nexpura-charcoal-700"
      : "text-nexpura-oxblood";

  const itemLabel = jobType === "bespoke" ? jobTitle || itemType || "—" : itemType || "—";

  const statusLabel = status || (jobType === "stock" ? "Pending sale" : "Draft");

  // Tooltip text for disabled CTA — Section 12.8 spec.
  const disabledTooltip =
    missingFields.length > 0
      ? `Complete required fields to create job. Missing: ${missingFields.map((m) => m.label).join(", ")}.`
      : "";

  return (
    <aside className="w-full lg:w-80 lg:shrink-0">
      <div className="lg:sticky lg:top-8 space-y-4">
        {/* ─── Job Summary ─────────────────────────────────────────── */}
        <div className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-nexpura-taupe-100">
            <h3 className="text-sm font-semibold text-nexpura-charcoal tracking-[0.04em]">
              Live job summary
            </h3>
          </div>
          <dl className="px-5 py-4 space-y-2.5 text-sm">
            <Row label="Type">
              <span className="text-nexpura-charcoal font-medium">{typeLabel}</span>
            </Row>
            <Row label="Customer">
              <span className={`${customerCls} font-medium truncate max-w-[180px] inline-block text-right`}>
                {customerLabel}
              </span>
            </Row>
            <Row label={jobType === "bespoke" ? "Title" : "Item"}>
              <span className="text-nexpura-charcoal font-medium capitalize truncate max-w-[180px] inline-block text-right">
                {itemLabel}
              </span>
            </Row>
            <Row label="Status">
              <span className="text-nexpura-charcoal-700 capitalize">{statusLabel}</span>
            </Row>
            {jobType !== "stock" && (
              <Row label="Priority">
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                    PRIORITIES.find((p) => p.value === priority)?.color || "bg-stone-100 text-stone-600"
                  }`}
                >
                  {priority || "Normal"}
                </span>
              </Row>
            )}
            <Row label="Due">
              <span className="text-nexpura-charcoal-700">
                {dueDate
                  ? new Date(dueDate).toLocaleDateString("en-AU", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </Row>
            <div className="pt-2 mt-2 border-t border-nexpura-taupe-100 space-y-2.5">
              <Row label="Quote">
                <span className="text-nexpura-charcoal font-medium">{formatCurrency(quoteAmount)}</span>
              </Row>
              <Row label="Deposit">
                <span className="text-nexpura-charcoal-700">{formatCurrency(depositAmount)}</span>
              </Row>
              <Row label="Balance">
                <span
                  className={`font-semibold ${
                    balanceRemaining > 0 ? "text-nexpura-oxblood" : "text-nexpura-emerald-deep"
                  }`}
                >
                  {formatCurrency(balanceRemaining)}
                </span>
              </Row>
            </div>
          </dl>
        </div>

        {/* ─── Alerts / Required ───────────────────────────────────── */}
        <div className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-nexpura-taupe-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-nexpura-charcoal tracking-[0.04em]">
              Alerts
            </h3>
            <span className="text-[11px] text-nexpura-charcoal-500 font-medium tracking-[0.06em] uppercase">
              {completedCount}/{steps.length} sections
            </span>
          </div>
          <div className="px-5 py-4 space-y-3">
            {missingFields.length === 0 && warnings.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-nexpura-emerald-deep">
                <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden />
                <span>All required fields complete.</span>
              </div>
            ) : (
              <>
                {missingFields.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-nexpura-oxblood shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="text-xs font-semibold tracking-[0.06em] uppercase text-nexpura-oxblood">
                        Missing required
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {missingFields.map((m, i) => (
                        <li key={`${m.label}-${i}`}>
                          <button
                            type="button"
                            onClick={() => onJumpToStep(m.stepIndex)}
                            className="w-full flex items-center justify-between gap-2 text-left text-sm text-nexpura-charcoal-700 hover:text-nexpura-charcoal hover:bg-nexpura-champagne/40 rounded-md px-2 py-1.5 -mx-2 transition-colors"
                          >
                            <span>{m.label}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-nexpura-taupe-400 shrink-0" aria-hidden />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {warnings.length > 0 && (
                  <div className={missingFields.length > 0 ? "pt-3 border-t border-nexpura-taupe-100" : ""}>
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldAlert className="w-4 h-4 text-nexpura-amber-muted shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="text-xs font-semibold tracking-[0.06em] uppercase text-nexpura-amber-muted">
                        Warnings
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {warnings.map((w, i) => (
                        <li
                          key={i}
                          className="text-sm text-nexpura-charcoal-700 bg-nexpura-amber-bg/60 border border-nexpura-amber-muted/20 rounded-md px-2.5 py-1.5"
                        >
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ─── Footer Actions ──────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="relative group">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!isFormValid || isPending}
              aria-disabled={!isFormValid || isPending}
              title={!isFormValid ? disabledTooltip : undefined}
              className={[
                "w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold transition-colors",
                "bg-nexpura-charcoal text-white hover:bg-nexpura-charcoal-700",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-charcoal focus-visible:ring-offset-2",
              ].join(" ")}
            >
              {isPending && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {isPending ? "Creating…" : "Save & Create Job"}
            </button>
            {!isFormValid && !isPending && missingFields.length > 0 && (
              <div
                role="tooltip"
                className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity bg-nexpura-charcoal text-white text-xs rounded-md px-3 py-2 shadow-lg max-w-[16rem] z-10"
              >
                {disabledTooltip}
              </div>
            )}
          </div>
          {onSaveDraft && (
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isPending}
              className="w-full px-5 py-2.5 rounded-lg text-sm font-medium text-nexpura-charcoal-700 bg-nexpura-ivory-elevated border border-nexpura-taupe-100 hover:bg-nexpura-champagne/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save progress
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="w-full px-5 py-2 text-sm text-nexpura-charcoal-500 hover:text-nexpura-charcoal transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-nexpura-charcoal-500 text-xs tracking-[0.04em] uppercase">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
