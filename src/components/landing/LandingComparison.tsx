// ============================================
// "Built for jewellers — not forced onto them"
// 3-column category comparison per Kaitlyn 2026-04-26.
// Replaces the prior 2-column compare (preserved at
// LandingComparison.legacy.tsx).
// ============================================

import React from "react"

type Column = {
  key: "generic" | "legacy" | "nexpura"
  label: string
  points: string[]
}

const COLUMNS: Column[] = [
  {
    key: "generic",
    label: "Generic POS",
    points: [
      "Built mainly for checkout",
      "Limited repair visibility",
      "Basic stock records",
      "Weak bespoke workflow",
      "No digital passport layer",
      "Little jewellery-specific intelligence",
    ],
  },
  {
    key: "legacy",
    label: "Legacy jewellery software",
    points: [
      "Jewellery-specific but often dated",
      "Can feel complex to train staff on",
      "Reporting can require manual work",
      "Customer experience may feel disconnected",
      "Less modern AI/product layer",
      "Harder to present as premium to clients",
    ],
  },
  {
    key: "nexpura",
    label: "Nexpura",
    points: [
      "Modern jewellery operating system",
      "POS, repairs, bespoke, stock, CRM, and passports connected",
      "AI Copilot for operational insights",
      "QR-verifiable digital passports",
      "Guided migration and onboarding",
      "Built for premium jewellery teams",
    ],
  },
]

export default function LandingComparison() {
  return (
    <section
      id="comparison"
      className="bg-m-ivory px-6 py-20 md:py-24 lg:py-28"
      aria-labelledby="comparison-heading"
    >
      <div className="mx-auto max-w-6xl">
        {/* Intro */}
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
          <span className="inline-block font-sans text-[0.78rem] font-medium uppercase tracking-[0.22em] text-[#8A8276] mb-4">
            The category
          </span>
          <h2
            id="comparison-heading"
            className="font-serif text-m-charcoal text-[1.85rem] leading-[1.15] tracking-[-0.005em] md:text-[2.4rem]"
          >
            Built for jewellers — not forced onto them
          </h2>
          <p className="mt-5 text-m-text-secondary text-[1rem] md:text-[1.1rem] leading-[1.55] max-w-[720px] mx-auto">
            Generic POS systems are built for checkout. Legacy jewellery
            software can feel heavy and dated. Nexpura is designed as a modern
            operating system for jewellery workflows.
          </p>
        </div>

        {/* 3-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-stretch">
          {COLUMNS.map((col) => {
            const isFeatured = col.key === "nexpura"
            return (
              <ComparisonCard key={col.key} col={col} featured={isFeatured} />
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ComparisonCard({ col, featured }: { col: Column; featured: boolean }) {
  return (
    <div
      className={
        featured
          ? "relative flex flex-col rounded-2xl p-7 md:p-8 transition-all duration-200 bg-white border border-[#C9A24A]/40 shadow-[0_30px_80px_-30px_rgba(60,40,20,0.18)] md:-my-3"
          : "relative flex flex-col rounded-2xl p-7 md:p-8 transition-all duration-200 bg-white/40 border border-[#E4DBC9]"
      }
      style={
        featured
          ? {
              backgroundImage:
                "radial-gradient(circle at 50% -10%, rgba(201,162,74,0.08), transparent 60%)",
            }
          : undefined
      }
    >
      {/* "Modern approach" tag — only on featured column */}
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-[#0E0E10] text-white px-3.5 py-1.5 font-sans text-[0.7rem] font-medium uppercase tracking-[0.18em]">
          <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-[#C9A24A]" />
          Modern approach
        </span>
      )}

      {/* Column label */}
      <div className="mb-6 pb-5 border-b border-[#E4DBC9]">
        <div className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-[#8A8276] mb-2">
          {featured ? "The platform" : "The old way"}
        </div>
        <h3
          className={
            featured
              ? "font-serif leading-[1.2] text-m-charcoal text-[1.5rem] md:text-[1.7rem]"
              : "font-serif leading-[1.2] text-[#5A554C] text-[1.25rem] md:text-[1.35rem]"
          }
        >
          {col.label}
        </h3>
      </div>

      {/* Points */}
      <ul role="list" className="space-y-3.5">
        {col.points.map((point) => (
          <li
            key={point}
            className={
              featured
                ? "flex items-start gap-3 text-[0.94rem] leading-[1.55] text-m-charcoal"
                : "flex items-start gap-3 text-[0.94rem] leading-[1.55] text-m-text-secondary"
            }
          >
            <PointMark featured={featured} />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Tick for featured column, neutral dot for others
function PointMark({ featured }: { featured: boolean }) {
  if (featured) {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#C9A24A]/15 text-[#A8852C] flex-shrink-0"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-[#B9B0A1] flex-shrink-0"
    />
  )
}
