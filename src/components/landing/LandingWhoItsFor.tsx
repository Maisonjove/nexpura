// ============================================
// "Built around the way jewellers actually operate"
// REVIVED + UPDATED from the parked version (Kaitlyn 2026-04-26).
// Now renders late on the homepage, after LandingDigitalPassport.
// ============================================

import React from "react"
import Link from "next/link"
import { SECTION_PADDING, HEADING, INTRO_SPACING, CARD, CONTAINER, INLINE_LINK } from "./_tokens"

type Audience = {
  title: string
  body: string
  pills: string[]
  icon: React.ReactNode
}

const Icon = {
  retail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8a3 3 0 1 1 6 0" />
    </svg>
  ),
  workshop: (
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
  multistore: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21V8l6-3v16" />
      <path d="M9 21V11l8-3v13" />
      <path d="M3 21h18" />
    </svg>
  ),
}

const AUDIENCES: Audience[] = [
  {
    title: "Retail jewellers",
    body:
      "Connect POS, stock, customer history, repairs, and digital passports at the point of sale.",
    pills: ["POS", "Inventory", "CRM", "Passports"],
    icon: Icon.retail,
  },
  {
    title: "Repairs & workshops",
    body:
      "Track intake, quotes, photos, staff assignment, due dates, customer updates, and collection readiness.",
    pills: ["Repairs", "Jobs", "Staff", "Updates"],
    icon: Icon.workshop,
  },
  {
    title: "Bespoke studios",
    body:
      "Manage enquiries, quotes, sketches, approvals, deposits, sourcing, production notes, and final handover.",
    pills: ["Bespoke", "Approvals", "Deposits", "Sourcing"],
    icon: Icon.bespoke,
  },
  {
    title: "Multi-store groups",
    body:
      "Centralise stock, staff, customers, reporting, locations, and workflow visibility across every store.",
    pills: ["Locations", "Stock", "Teams", "Reports"],
    icon: Icon.multistore,
  },
]

export default function LandingWhoItsFor() {
  return (
    <section
      id="who-its-for"
      className={`bg-m-ivory ${SECTION_PADDING.standard}`}
      aria-labelledby="who-its-for-heading"
    >
      <div className={CONTAINER.wide}>
        {/* Intro */}
        <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
          <span className={HEADING.eyebrow}>
            Built for jewellers
          </span>
          <h2
            id="who-its-for-heading"
            className={HEADING.h2}
          >
            Built around the way jewellers actually operate
          </h2>
          <p className={`${HEADING.subhead} max-w-[700px] mx-auto`}>
            Whether you sell, repair, create, or manage multiple locations,
            Nexpura supports the workflows that generic retail systems miss.
          </p>
        </div>

        {/* 2x2 grid on desktop, stacks on mobile */}
        <ul role="list" className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {AUDIENCES.map((a) => (
            <li
              key={a.title}
              className={`group relative flex flex-col ${CARD.base} ${CARD.paddingStandard} ${CARD.hover}`}
            >
              <span
                className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#F1E9D8] text-m-charcoal mb-5"
                aria-hidden="true"
              >
                <span className="block w-5 h-5">{a.icon}</span>
              </span>

              <h3 className="font-serif text-m-charcoal text-[1.25rem] md:text-[1.35rem] leading-[1.25] mb-3">
                {a.title}
              </h3>

              <p className="text-m-text-secondary text-[0.97rem] leading-[1.55] mb-6">
                {a.body}
              </p>

              {/* Spacer pushes pills to bottom for even card heights */}
              <div className="flex-1" />

              <ul role="list" className="flex flex-wrap gap-2">
                {a.pills.map((pill) => (
                  <li
                    key={pill}
                    className="inline-flex items-center rounded-full bg-[#F1E9D8] border border-[#E4DBC9] px-3 py-1.5 font-sans text-[0.78rem] font-medium tracking-[0.01em] text-[#5A554C]"
                  >
                    {pill}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        {/* Onward link — Batch 2 */}
        <div className="text-center mt-12 md:mt-14">
          <Link href="/features" className={INLINE_LINK}>
            See the workflows for your business
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
