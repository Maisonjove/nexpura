"use client";

import { Wrench, Sparkles, Package } from "lucide-react";
import type { JobType } from "../types";

interface Option {
  type: JobType;
  label: string;
  helper: string;
  Icon: typeof Wrench;
}

// Section 12.1 — segmented type selector. Title + one-line description +
// thin-line Lucide icon per option. Selected = charcoal-900 fill / white
// text. Unselected = ivory-elevated bg + taupe-100 border + charcoal-700
// text. Hover (unselected) = champagne bg.
const OPTIONS: Option[] = [
  {
    type: "repair",
    label: "Repair",
    helper: "Restore, resize, service or modify an existing piece",
    Icon: Wrench,
  },
  {
    type: "bespoke",
    label: "Bespoke",
    helper: "Create a custom piece from brief to production",
    Icon: Sparkles,
  },
  {
    type: "stock",
    label: "Stock Item",
    helper: "Sell or document ready-made inventory",
    Icon: Package,
  },
];

interface Props {
  value: JobType;
  onChange: (type: JobType) => void;
  disabled?: boolean;
}

export default function SegmentedTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6" role="tablist" aria-label="Intake type">
      {OPTIONS.map(({ type, label, helper, Icon }) => {
        const selected = value === type;
        return (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(type)}
            disabled={disabled}
            className={[
              "relative text-left px-5 py-4 rounded-2xl border transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexpura-charcoal focus-visible:ring-offset-2",
              selected
                ? "bg-nexpura-charcoal text-white border-nexpura-charcoal shadow-sm"
                : "bg-nexpura-ivory-elevated text-nexpura-charcoal-700 border-nexpura-taupe-100 hover:bg-nexpura-champagne hover:border-nexpura-taupe-200",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <Icon
                className={selected ? "w-5 h-5 text-white shrink-0 mt-0.5" : "w-5 h-5 text-nexpura-charcoal-700 shrink-0 mt-0.5"}
                strokeWidth={1.5}
                aria-hidden
              />
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${selected ? "text-white" : "text-nexpura-charcoal"}`}>
                  {label}
                </div>
                <div
                  className={`text-xs mt-0.5 leading-snug ${
                    selected ? "text-white/80" : "text-nexpura-charcoal-500"
                  }`}
                >
                  {helper}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
