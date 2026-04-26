// ============================================
// "One system of record for every jewellery workflow"
// Per Kaitlyn 2026-04-26 brief — replaces the previous 10-module
// equal-weight list (preserved at LandingPlatformModules.legacy.tsx
// for repurposing on the dedicated /features page later).
// Verbatim from spec except the "Explore all features" <a opener was
// missing in the spec — restored.
// ============================================

import React from "react"
import Link from "next/link"

type Module = {
  title: string
  body: string
  icon: React.ReactNode
}

// Inline SVG icons — strokeWidth 1.5, currentColor for theming
const Icon = {
  pos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 15h2" />
      <path d="M13 15h3" />
    </svg>
  ),
  repairs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4 20 8-8" />
      <path d="M14 6a4 4 0 0 1 4 4l3 3-3 3-3-3a4 4 0 0 1-4-4 4 4 0 0 1 3-3Z" />
    </svg>
  ),
  bespoke: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9 12 3l6 6-6 12L6 9Z" />
      <path d="M3 9h18" />
    </svg>
  ),
  inventory: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z" />
      <path d="M3.27 6.96 12 12l8.73-5.04" />
      <path d="M12 22V12" />
    </svg>
  ),
  crm: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  insights: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
      <circle cx="18" cy="6" r="1.5" />
    </svg>
  ),
}

const MODULES: Module[] = [
  {
    title: "POS & Sales",
    body:
      "Process jewellery sales with connected customer, stock, payment, and item history.",
    icon: Icon.pos,
  },
  {
    title: "Repairs & Workshop",
    body:
      "Log, assign, update, and close repair jobs from intake to collection.",
    icon: Icon.repairs,
  },
  {
    title: "Bespoke Orders",
    body:
      "Manage custom jobs with quotes, approvals, milestones, deposits, sourcing, and production notes.",
    icon: Icon.bespoke,
  },
  {
    title: "Inventory & Memo",
    body:
      "Track pieces, stones, components, reservations, locations, memo, consignment, and movement history.",
    icon: Icon.inventory,
  },
  {
    title: "Customers & CRM",
    body:
      "Keep purchase history, preferences, repairs, bespoke jobs, and service records connected.",
    icon: Icon.crm,
  },
  {
    title: "Insights & AI",
    body:
      "Ask questions, surface risks, and understand what needs attention across stock, sales, jobs, and performance.",
    icon: Icon.insights,
  },
]

export default function LandingPlatformModules() {
  return (
    <section
      id="platform-modules"
      className="bg-m-ivory px-6 py-20 md:py-24 lg:py-28"
      aria-labelledby="platform-modules-heading"
    >
      <div className="mx-auto max-w-6xl">
        {/* Intro */}
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-14">
          <h2
            id="platform-modules-heading"
            className="font-serif text-m-charcoal text-[1.85rem] leading-[1.15] tracking-[-0.005em] md:text-[2.4rem]"
          >
            One system of record for every jewellery workflow
          </h2>
          <p className="mt-5 text-m-text-secondary text-[1rem] md:text-[1.1rem] leading-[1.55] max-w-[680px] mx-auto">
            Nexpura connects the operational data jewellers rely on every day —
            sales, stock, repairs, bespoke jobs, customers, payments, passports,
            and performance.
          </p>
        </div>

        {/* 3x2 grid on desktop, 2-up on tablet, stack on mobile */}
        <ul
          role="list"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6"
        >
          {MODULES.map((m) => (
            <li
              key={m.title}
              className="group relative flex flex-col rounded-2xl border border-[#E4DBC9] bg-white/60 p-7 md:p-8 transition-all duration-200 hover:border-[#C9BFA9] hover:bg-white/80 hover:-translate-y-0.5"
            >
              <span
                className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#F1E9D8] text-m-charcoal mb-5"
                aria-hidden="true"
              >
                <span className="w-5 h-5 block">{m.icon}</span>
              </span>

              <h3 className="font-serif text-m-charcoal text-[1.2rem] md:text-[1.3rem] leading-[1.25] mb-3">
                {m.title}
              </h3>

              <p className="text-m-text-secondary text-[0.97rem] leading-[1.55]">
                {m.body}
              </p>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="text-center mt-12 md:mt-14">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 rounded-full bg-[#111] text-white border border-[#111] px-7 py-3.5 text-[0.95rem] font-medium transition-all duration-200 hover:bg-[#2a2a2a] hover:-translate-y-0.5"
          >
            Explore all features
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
