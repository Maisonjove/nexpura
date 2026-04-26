'use client'

// ============================================
// "Questions jewellers ask before switching"
// 5 FAQs only — accordion-style, accessible.
// Per Kaitlyn 2026-04-26 brief — replaces the prior LandingFaq
// (renamed to LandingFaq.legacy.tsx on disk to avoid case-conflict
// with this filename under tsconfig's forceConsistentCasingInFileNames).
// Spec was missing the opening <a tag on "Talk to the team" — restored
// using next/link for SPA nav + lint.
// ============================================

import { useState } from "react"
import Link from "next/link"
import { SECTION_PADDING, HEADING, INTRO_SPACING, INLINE_LINK, CONTAINER } from "./_tokens"

type FAQ = {
  id: string
  question: string
  answer: string
}

const FAQS: FAQ[] = [
  {
    id: "replace-pos",
    question: "Can Nexpura replace my current POS?",
    answer:
      "Nexpura is designed to centralise jewellery retail workflows including POS, inventory, customers, repairs, bespoke orders, digital passports, and reporting. The best setup depends on your current tools and business needs.",
  },
  {
    id: "repairs-bespoke",
    question: "Does Nexpura support repairs and bespoke orders?",
    answer:
      "Yes. Nexpura includes repair tracking from intake to collection, plus bespoke workflows for quotes, approvals, deposits, sourcing, milestones, and production notes.",
  },
  {
    id: "migration",
    question: "Can I migrate my existing data?",
    answer:
      "Guided migration is available to help move key customer, inventory, repair, supplier, and business records into Nexpura.",
  },
  {
    id: "free-trial",
    question: "Is there a free trial?",
    answer:
      "Yes. You can start with a 14-day free trial and explore the core workflows before choosing a plan.",
  },
  {
    id: "book-demo",
    question: "Can I book a demo instead?",
    answer:
      "Yes. A guided walkthrough can help map Nexpura to your current POS, repair, bespoke, inventory, and customer workflows.",
  },
]

export default function LandingFAQ() {
  const [openId, setOpenId] = useState<string | null>(FAQS[0].id)

  return (
    <section
      id="faq"
      className={`bg-m-ivory ${SECTION_PADDING.compact}`}
      aria-labelledby="faq-heading"
    >
      <div className={CONTAINER.narrow}>
        {/* Intro */}
        <div className={`text-center ${INTRO_SPACING.compact}`}>
          <span className={HEADING.eyebrow}>
            FAQ
          </span>
          <h2
            id="faq-heading"
            className={HEADING.h2}
          >
            Questions jewellers ask before switching
          </h2>
          <p className={HEADING.subhead}>
            Clear answers about trial, migration, POS, repairs, and setup.
          </p>
        </div>

        {/* Accordion list */}
        <ul role="list" className="space-y-3">
          {FAQS.map((faq) => {
            const isOpen = openId === faq.id
            return (
              <li key={faq.id}>
                <div
                  className={
                    isOpen
                      ? "rounded-2xl border bg-white/85 transition-all duration-200 border-[#C9BFA9]"
                      : "rounded-2xl border bg-white/60 transition-all duration-200 border-[#E4DBC9] hover:border-[#C9BFA9]"
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
                    <p className="text-m-text-secondary text-[0.97rem] leading-[1.65] max-w-[600px]">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {/* Trailing prompt for everything else */}
        <div className="text-center mt-12 md:mt-14">
          <p className="font-sans text-[0.95rem] text-m-text-secondary">
            More questions about migration, pricing, or specific features?{" "}
            <Link
              href="/contact"
              className={INLINE_LINK}
            >
              Talk to the team
            </Link>
            .
          </p>
        </div>
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
      {/* Horizontal line — always visible */}
      <span className="absolute w-3 h-px bg-current" />
      {/* Vertical line — hidden when open */}
      <span
        className={
          open
            ? "absolute w-px h-3 bg-current transition-transform duration-200 scale-y-0"
            : "absolute w-px h-3 bg-current transition-transform duration-200 scale-y-100"
        }
      />
    </span>
  )
}
