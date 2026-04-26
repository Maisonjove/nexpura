// ============================================
// Compact 3-step migration reassurance strip
// Sits between Comparison and FAQ. Per Kaitlyn 2026-04-26
// additive-pass + the 9-fix follow-up:
//  - Heading + subheading copy updated.
//  - Trailing "See full migration support →" link removed (the
//    /migration page doesn't exist yet — section ends at the cards).
//  - Padding stays SECTION_PADDING.compact; intro spacing stays
//    INTRO_SPACING.compact.
// ============================================

import React from "react"
import { SECTION_PADDING, HEADING, INTRO_SPACING, CARD, CONTAINER } from "./_tokens"

type Step = {
  number: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    number: "01",
    title: "Discovery",
    body:
      "We review your current tools, data, and workflows to map a switch that fits your business.",
  },
  {
    number: "02",
    title: "Guided migration",
    body:
      "Customer, inventory, repair, and supplier records are moved across with hands-on support.",
  },
  {
    number: "03",
    title: "Go live",
    body:
      "Your team is trained on the workflows that matter most, and you start running on Nexpura.",
  },
]

export default function LandingMigrationStrip() {
  return (
    <section
      id="migration"
      className={`bg-m-ivory ${SECTION_PADDING.compact}`}
      aria-labelledby="migration-heading"
    >
      <div className={CONTAINER.medium}>
        {/* Intro */}
        <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.compact}`}>
          <span className={HEADING.eyebrow}>
            Migration
          </span>
          <h2
            id="migration-heading"
            className={HEADING.h2}
          >
            Switch with guidance at every step
          </h2>
          <p className={`${HEADING.subhead} max-w-[600px] mx-auto`}>
            Move from your current setup with hands-on support across data,
            workflows, training, and go-live.
          </p>
        </div>

        {/* 3-step row */}
        <ol
          role="list"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5 relative"
        >
          {STEPS.map((step, i) => (
            <li
              key={step.number}
              className={`relative flex flex-col ${CARD.base} ${CARD.paddingCompact} ${CARD.hover}`}
            >
              {/* Step number */}
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#0E0E10] text-white font-sans text-[0.78rem] font-medium tracking-[0.05em]"
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <h3 className="font-serif text-m-charcoal text-[1.15rem] leading-[1.25]">
                  {step.title}
                </h3>
              </div>

              <p className="text-m-text-secondary text-[0.93rem] leading-[1.55]">
                {step.body}
              </p>

              {/* Connector arrow — desktop only, between steps */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="hidden md:flex absolute top-1/2 -right-3 z-10 -translate-y-1/2 w-6 h-6 items-center justify-center text-[#C9BFA9]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
