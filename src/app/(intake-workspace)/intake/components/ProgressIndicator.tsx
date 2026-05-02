"use client";

import { Check } from "lucide-react";
import type { JobType } from "../types";

// Section 12.2 — slim horizontal progress indicator. Per-type step labels.
// - Future: taupe-100 fill, charcoal-500 text
// - Current: charcoal-900 fill, white text
// - Completed: bronze fill + check icon
// Clicking a completed step jumps back to it (handled by parent via
// onStepClick).

export interface Step {
  id: string;
  label: string;
}

const STEP_DEFS: Record<JobType, Step[]> = {
  repair: [
    { id: "customer", label: "Customer" },
    { id: "item", label: "Item" },
    { id: "work", label: "Work Required" },
    { id: "pricing", label: "Pricing" },
    { id: "review", label: "Review" },
  ],
  bespoke: [
    { id: "customer", label: "Customer" },
    { id: "brief", label: "Brief" },
    { id: "design", label: "Design Details" },
    { id: "materials", label: "Materials" },
    { id: "pricing", label: "Pricing" },
    { id: "review", label: "Review" },
  ],
  stock: [
    { id: "customer", label: "Customer" },
    { id: "item", label: "Item selection" },
    { id: "sale", label: "Sale details" },
    { id: "payment", label: "Payment" },
    { id: "review", label: "Review" },
  ],
};

export function getSteps(jobType: JobType): Step[] {
  return STEP_DEFS[jobType];
}

interface Props {
  jobType: JobType;
  currentIndex: number;
  completedSet: Set<number>;
  onStepClick: (index: number) => void;
}

export default function ProgressIndicator({
  jobType,
  currentIndex,
  completedSet,
  onStepClick,
}: Props) {
  const steps = STEP_DEFS[jobType];

  return (
    <nav
      aria-label="Intake progress"
      className="bg-nexpura-ivory-elevated border border-nexpura-taupe-100 rounded-xl px-4 py-3 mb-6"
    >
      <ol className="flex items-center gap-2 overflow-x-auto">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const isCompleted = completedSet.has(i) && !isCurrent;
          const isClickable = isCompleted || i < currentIndex;

          const circleCls = isCompleted
            ? "bg-nexpura-bronze text-white border-nexpura-bronze"
            : isCurrent
              ? "bg-nexpura-charcoal text-white border-nexpura-charcoal"
              : "bg-nexpura-taupe-100 text-nexpura-charcoal-500 border-nexpura-taupe-100";

          const labelCls = isCurrent
            ? "text-nexpura-charcoal font-semibold"
            : isCompleted
              ? "text-nexpura-charcoal-700"
              : "text-nexpura-charcoal-500";

          return (
            <li key={step.id} className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(i)}
                disabled={!isClickable}
                aria-current={isCurrent ? "step" : undefined}
                className={[
                  "flex items-center gap-2 group",
                  isClickable ? "cursor-pointer" : "cursor-default",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-charcoal/40 rounded-md px-1 py-0.5",
                ].join(" ")}
              >
                <span
                  className={[
                    "w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-semibold transition-colors",
                    circleCls,
                  ].join(" ")}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden /> : i + 1}
                </span>
                <span className={`text-xs whitespace-nowrap ${labelCls}`}>{step.label}</span>
              </button>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="w-6 h-px bg-nexpura-taupe-100"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
