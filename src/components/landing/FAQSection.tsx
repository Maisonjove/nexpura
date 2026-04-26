'use client'

// ============================================
// Shared FAQ accordion (homepage + pricing). Per Kaitlyn 2026-04-26
// reversal of the earlier "make pricing visually different" pass —
// both pages now consume this single component and pass their own
// content via props.
//
// Visual treatment is the canonical card-style accordion (rounded
// rectangles, warm borders, serif question text, circular cream
// plus/minus button). One item open at a time.
//
// Replaces the previous LandingFAQ.tsx (homepage-only) and the
// inline line-based accordion that lived inside PricingClient.tsx.
// ============================================

import React, { useState } from 'react'

export type FAQItem = {
  id: string
  question: string
  answer: string
}

type Props = {
  /** Eyebrow above the heading. Defaults to "FAQ". Pass an empty
   *  string to suppress. */
  eyebrow?: string
  heading: string
  subheading?: string
  faqs: FAQItem[]
  /** Which item is open on first render. Defaults to the first item. */
  defaultOpenId?: string
  /** Optional content rendered centred below the accordion (e.g. the
   *  homepage's "Talk to the team" link). Pricing intentionally omits
   *  this since the page already has CTAs nearby. */
  trailingNote?: React.ReactNode
}

export default function FAQSection({
  eyebrow = 'FAQ',
  heading,
  subheading,
  faqs,
  defaultOpenId,
  trailingNote,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(
    defaultOpenId ?? faqs[0]?.id ?? null
  )

  return (
    <section
      id="faq"
      className="bg-m-ivory px-6 py-14 md:py-16"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl">
        {/* Intro */}
        <div className="text-center mb-12 md:mb-14">
          {eyebrow && (
            <span className="inline-block font-sans text-[0.78rem] font-medium uppercase tracking-[0.22em] text-[#8A8276] mb-4">
              {eyebrow}
            </span>
          )}
          <h2
            id="faq-heading"
            className="font-serif text-m-charcoal text-[1.85rem] leading-[1.15] tracking-[-0.005em] md:text-[2.4rem]"
          >
            {heading}
          </h2>
          {subheading && (
            <p className="mt-5 text-m-text-secondary text-[1rem] md:text-[1.1rem] leading-[1.55]">
              {subheading}
            </p>
          )}
        </div>

        {/* Accordion list — card-style */}
        <ul role="list" className="space-y-3">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id
            return (
              <li key={faq.id}>
                <div
                  className={
                    isOpen
                      ? 'rounded-2xl border bg-white/85 transition-all duration-200 border-[#C9BFA9]'
                      : 'rounded-2xl border bg-white/60 transition-all duration-200 border-[#E4DBC9] hover:border-[#C9BFA9]'
                  }
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${faq.id}`}
                    id={`faq-trigger-${faq.id}`}
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                    className="w-full text-left flex items-center justify-between gap-6 px-6 md:px-7 py-5 md:py-6 font-serif text-m-charcoal text-[1.05rem] md:text-[1.15rem] leading-[1.35]"
                  >
                    <span>{faq.question}</span>
                    <PlusMinusIcon open={isOpen} />
                  </button>

                  <div
                    id={`faq-panel-${faq.id}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${faq.id}`}
                    hidden={!isOpen}
                    className="px-6 md:px-7 pb-6 md:pb-7"
                  >
                    <p className="font-sans text-m-text-secondary text-[0.97rem] leading-[1.65] max-w-[600px]">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Optional trailing note (e.g. homepage "Talk to the team") */}
        {trailingNote && (
          <div className="text-center mt-12 md:mt-14">
            {trailingNote}
          </div>
        )}
      </div>
    </section>
  )
}

function PlusMinusIcon({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#F1E9D8] text-m-charcoal flex-shrink-0 transition-transform duration-200"
    >
      <span className="absolute w-3 h-px bg-current" />
      <span
        className={
          open
            ? 'absolute w-px h-3 bg-current transition-transform duration-200 scale-y-0'
            : 'absolute w-px h-3 bg-current transition-transform duration-200 scale-y-100'
        }
      />
    </span>
  )
}
