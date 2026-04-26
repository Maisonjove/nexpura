// ============================================
// Compact 3-step migration reassurance strip
// Sits between Comparison and FAQ. Per Kaitlyn 2026-04-26
// additive-pass brief. Spec was missing the opening <a tag on
// "See full migration support" — restored.
// ============================================

import React from "react"
import Link from "next/link"

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
      className="bg-m-ivory px-6 py-20 md:py-24"
      aria-labelledby="migration-heading"
    >
      <div className="mx-auto max-w-5xl">
        {/* Intro */}
        <div className="mx-auto max-w-3xl text-center mb-12 md:mb-14">
          <span className="inline-block font-sans text-[0.78rem] font-medium uppercase tracking-[0.22em] text-[#8A8276] mb-4">
            Migration
          </span>
          <h2
            id="migration-heading"
            className="font-serif text-m-charcoal text-[1.7rem] leading-[1.15] tracking-[-0.005em] md:text-[2.2rem]"
          >
            Switching is guided, not solo
          </h2>
          <p className="mt-4 text-m-text-secondary text-[1rem] leading-[1.55] max-w-[600px] mx-auto">
            Move from your current setup with hands-on support at each stage.
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
              className="relative flex flex-col rounded-2xl border border-[#E4DBC9] bg-white/60 p-6 md:p-7 transition-all duration-200 hover:border-[#C9BFA9] hover:bg-white/80"
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

        {/* Trailing link to dedicated migration page */}
        <div className="text-center mt-10 md:mt-12">
          <Link
            href="/migration"
            className="inline-flex items-center gap-2 font-sans text-[0.95rem] font-medium text-m-charcoal border-b border-m-charcoal pb-0.5 transition-opacity duration-200 hover:opacity-70"
          >
            See full migration support
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
