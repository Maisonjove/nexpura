'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Button from '@/components/landing/ui/Button'
import { BUTTON } from '@/components/landing/_tokens'
import FAQSection, { type FAQItem } from '@/components/landing/FAQSection'
import CurrencySelector from '@/components/pricing/CurrencySelector'
import {
  PLANS,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from '@/data/pricing'

/**
 * Pricing page restyled to the homepage system per Kaitlyn brief #2
 * Section 10B. Structure, content, plan names, comparison table rows,
 * FAQ copy — all preserved verbatim.
 *
 * 2026-04-26 update (Kaitlyn pricing brief on PR #42):
 *  - Plan data moved to src/data/pricing.ts as a single source of truth
 *    with multi-currency (AUD / USD / GBP / EUR) regional pricing.
 *  - Adds <CurrencyPicker /> above the plan grid with localStorage
 *    persistence. Initial currency comes from `x-vercel-ip-country`
 *    server-side — see ./page.tsx.
 *  - Plan card CTAs append &currency=… to their primaryHref (and
 *    secondaryHref, when present) so the future Stripe checkout step
 *    can resolve the right stripePriceId per (plan, currency) combo.
 *  - Per-plan CTA shape (Kaitlyn 2026-04-26): all three plans share
 *    "Start Free Trial" as primary; Studio + Atelier add a quieter
 *    secondary text link ("or book a demo" / "or talk to sales").
 *  - "From" prefix shown only when isFromPrice (Atelier).
 *  - "Most Popular" badge only when isFeatured (Studio).
 *
 * Visual layer (unchanged from previous polish-pass):
 *  - Page bg #FFFFFF → bg-m-ivory.
 *  - Plan cards use the standard card surface; featured plan is the
 *    one with a champagne border (was charcoal). 32px desktop /
 *    22px mobile padding meets the spacing token minimum.
 *  - Comparison table + FAQ accordion + final CTA all use m-* tokens.
 */

const EASE = [0.22, 1, 0.36, 1] as const

const fadeBlur = {
  initial: { opacity: 0, filter: 'blur(6px)' },
  whileInView: { opacity: 1, filter: 'blur(0px)' },
  viewport: { once: true } as const,
  transition: { duration: 1.2, ease: EASE },
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, filter: 'blur(4px)', y: 16 },
  whileInView: { opacity: 1, filter: 'blur(0px)', y: 0 },
  viewport: { once: true } as const,
  transition: { duration: 1.2, ease: EASE, delay },
})

const comparisonGroups = [
  {
    heading: 'Core platform',
    rows: [
      { key: 'Point of Sale', values: ['Yes', 'Yes', 'Yes'] },
      { key: 'Inventory', values: ['Yes', 'Yes', 'Yes'] },
      { key: 'Repairs', values: ['Yes', 'Yes', 'Yes'] },
      { key: 'Bespoke', values: ['Yes', 'Yes', 'Yes'] },
      { key: 'CRM', values: ['Yes', 'Yes', 'Yes'] },
      { key: 'Invoicing', values: ['Yes', 'Yes', 'Yes'] },
      { key: 'Command Centers', values: ['Yes', 'Yes', 'Yes'] },
    ],
  },
  {
    heading: 'Growth and reporting',
    rows: [
      { key: 'Analytics', values: ['Basic', 'Full', 'Full'] },
      { key: 'Team size', values: ['1 staff', 'Up to 5', 'Unlimited'] },
      { key: 'Stores', values: ['1', 'Up to 3', 'Unlimited'] },
      { key: 'Custom branding', values: ['—', 'Yes', 'Yes'] },
    ],
  },
  {
    heading: 'Advanced tools',
    rows: [
      { key: 'Jeweller showcase website', values: ['—', 'Yes', 'Yes'] },
      { key: 'AI product descriptions', values: ['—', '—', 'Yes'] },
      { key: 'Custom analytics', values: ['—', '—', 'Yes'] },
    ],
  },
]

// Pricing FAQs — passed to the shared FAQSection so this page renders
// the same component the homepage uses (per Kaitlyn 2026-04-26
// reversal of the earlier "make pricing visually different" pass).
// Copy is verbatim from the spec.
const PRICING_FAQS: FAQItem[] = [
  {
    id: 'change-plans',
    question: 'Can I change plans later?',
    answer:
      'Yes. You can upgrade or downgrade at any time from your account settings, and changes take effect at the start of your next billing cycle.',
  },
  {
    id: 'setup-fee',
    question: 'Is there a setup fee?',
    answer:
      'No setup fee. Guided onboarding and migration support are included with every plan.',
  },
  {
    id: 'free-trial-includes',
    question: "What's included in the free trial?",
    answer:
      "Full access to your selected plan's workflows for 14 days, including POS, repairs, bespoke, inventory, customers, and reporting.",
  },
  {
    id: 'annual-billing',
    question: 'Do you offer annual billing?',
    answer:
      'Yes. Annual billing is available on all plans with a discount versus monthly. Speak to our team for current annual pricing.',
  },
  {
    id: 'trial-ends',
    question: 'What happens after my trial ends?',
    answer:
      'At the end of your 14-day trial, you can choose to continue on a paid plan or pause your account. Your data is retained either way.',
  },
]

// Order of precedence: localStorage → server-detected initialCurrency → AUD fallback (handled upstream)
function useCurrency(initial: CurrencyCode) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(initial)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('nexpura_currency') as CurrencyCode | null
      if (stored && SUPPORTED_CURRENCIES.includes(stored)) {
        setCurrencyState(stored)
      }
    } catch {
      // localStorage may be unavailable (SSR, privacy mode) — silently keep initial.
    }
  }, [])
  const setCurrency = (next: CurrencyCode) => {
    setCurrencyState(next)
    try {
      localStorage.setItem('nexpura_currency', next)
    } catch {
      // ignore — picker still works in-memory for the session.
    }
  }
  return [currency, setCurrency] as const
}

// Note: the inline CurrencyPicker that previously lived here was
// replaced 2026-04-26 by the refined editorial control at
// src/components/pricing/CurrencySelector.tsx.

export default function PricingClient({
  initialCurrency,
}: {
  initialCurrency: CurrencyCode
}) {
  const [currency, setCurrency] = useCurrency(initialCurrency)

  return (
    <div className="bg-m-ivory">
      {/* Hero */}
      <section className="pt-24 pb-20 lg:pt-32 lg:pb-24 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p
            {...fadeUp()}
            className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-6"
          >
            Pricing
          </motion.p>
          <motion.h1
            {...fadeBlur}
            className="font-serif text-[42px] sm:text-[56px] lg:text-[clamp(2.75rem,5vw,4.5rem)] font-normal leading-[1.06] tracking-[-0.015em] text-m-charcoal mb-7"
          >
            Transparent <em className="italic">by design</em>
          </motion.h1>
          <motion.p
            {...fadeUp(0.3)}
            className="text-[16px] sm:text-[18px] leading-[1.55] text-m-text-secondary max-w-[600px] mx-auto"
          >
            Simple pricing for jewellers — with guided migration included and no transaction cuts. Start with the plan that fits your business and scale when you&apos;re ready.
          </motion.p>
          <motion.p
            {...fadeUp(0.45)}
            className="text-[12px] tracking-[0.16em] uppercase text-m-text-faint font-medium mt-8"
          >
            14 day free trial · No credit card required
          </motion.p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="pb-20 lg:pb-28 px-6 sm:px-10 lg:px-20">
        <div className="max-w-[1200px] mx-auto">
          {/* Currency selector — centred above the plan grid. With the
              4-tab inline pill switcher (Kaitlyn 2026-04-26), all options
              are always visible so right-aligning would read detached.
              Centred = a deliberate page-level control above the plans. */}
          <div className="flex justify-center mt-8 md:mt-10 mb-12 md:mb-14">
            <CurrencySelector value={currency} onChange={setCurrency} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {PLANS.map((plan, i) => {
              const price = plan.pricing[currency]
              const withCurrency = (href: string) =>
                href.includes('?')
                  ? `${href}&currency=${currency}`
                  : `${href}?currency=${currency}`
              const primaryUrl = withCurrency(plan.cta.primaryHref)
              const secondaryUrl = plan.cta.secondaryHref
                ? withCurrency(plan.cta.secondaryHref)
                : null
              const ctaClass = plan.id === 'boutique' ? BUTTON.primary : BUTTON.secondary

              return (
                <motion.div
                  key={plan.id}
                  {...fadeUp(i * 0.1)}
                  className={`relative flex flex-col p-[22px] sm:p-8 lg:p-10 rounded-[18px] border transition-all duration-[250ms] [transition-timing-function:var(--m-ease)] ${
                    plan.isFeatured
                      ? 'border-m-champagne bg-m-white-soft shadow-[0_18px_45px_rgba(0,0,0,0.06)]'
                      : 'border-m-border-soft bg-m-white-soft hover:-translate-y-1 hover:border-m-border-hover hover:shadow-[0_18px_45px_rgba(0,0,0,0.06)]'
                  }`}
                >
                  {plan.isFeatured && (
                    <span className="absolute -top-3 left-8 px-3 py-1 bg-m-champagne text-m-charcoal text-[10px] tracking-[0.18em] uppercase font-medium rounded-full">
                      Most Popular
                    </span>
                  )}
                  <h3 className="font-serif text-[28px] lg:text-[32px] font-medium text-m-charcoal mb-2 leading-[1.2]">
                    {plan.name}
                  </h3>
                  <p className="text-[14px] leading-[1.6] text-m-text-secondary mb-8 min-h-[2.5em]">
                    {plan.description}
                  </p>

                  <div className="mb-2">
                    <span className="font-sans text-[11px] tracking-[0.18em] uppercase text-m-text-faint font-medium">
                      {currency}
                    </span>
                  </div>
                  <div className="mb-8 flex items-baseline gap-2">
                    {plan.isFromPrice && (
                      <span className="font-sans text-[14px] text-m-text-faint">From</span>
                    )}
                    <span className="font-serif text-[48px] lg:text-[56px] text-m-charcoal leading-none">
                      {price.symbol}
                      {price.amount}
                    </span>
                    <span className="text-[14px] text-m-text-faint">/ month</span>
                  </div>

                  {/* Primary CTA + optional quieter secondary text link.
                      Per Kaitlyn 2026-04-26: every plan ships "Start Free
                      Trial" as primary so the row reads coherent; Studio
                      and Atelier add a small secondary link beneath
                      ("or book a demo" / "or talk to sales") for buyers
                      who aren't ready to self-serve. Secondary link uses
                      a quieter underline style and a fixed-height wrapper
                      so the primary buttons stay horizontally aligned
                      across all three cards. */}
                  <div className="mb-10">
                    <Link
                      href={primaryUrl}
                      className={`${ctaClass} w-full`}
                    >
                      {plan.cta.primaryLabel}
                    </Link>
                    <div className="h-6 mt-3 flex items-center justify-center">
                      {secondaryUrl && (
                        <Link
                          href={secondaryUrl}
                          className="font-sans text-[0.82rem] text-m-text-secondary hover:text-m-charcoal underline underline-offset-4 decoration-[#D6CDB8] hover:decoration-m-charcoal transition-colors duration-200"
                        >
                          {plan.cta.secondaryLabel}
                        </Link>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-3 flex-1">
                    {plan.features.map((h) => (
                      <li
                        key={h}
                        className="flex items-start gap-3 text-[14px] leading-[1.6] text-m-text-secondary"
                      >
                        <CheckIcon />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )
            })}
          </div>

          <p className="font-sans text-[0.85rem] text-[#8A8276] text-center mt-10">
            Prices shown based on region and exclude applicable taxes. Final billing currency is confirmed at checkout.
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20 lg:py-32 px-6 sm:px-10 lg:px-20 border-t border-m-border-soft bg-m-white-soft">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <motion.p
              {...fadeUp()}
              className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-4"
            >
              Compare Plans
            </motion.p>
            <motion.h2
              {...fadeBlur}
              className="font-serif text-[36px] sm:text-[44px] lg:text-[48px] font-normal leading-[1.12] tracking-[-0.01em] text-m-charcoal"
            >
              Compare plans at a glance
            </motion.h2>
          </div>

          <motion.div {...fadeUp(0.1)} className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b-2 border-m-charcoal">
                  <th className="text-left py-4 pr-4 text-[11px] tracking-[0.14em] uppercase text-m-text-muted font-medium w-1/2">
                    Feature
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.id}
                      className="text-center py-4 px-4 font-serif text-[20px] text-m-charcoal font-medium"
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonGroups.map((group) => (
                  <ComparisonGroup key={group.heading} group={group} />
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* === FAQ — shared FAQSection component (Kaitlyn 2026-04-26 reversal
          of the earlier "make pricing visually different" pass). Now
          renders identically to the homepage FAQ; only the heading,
          subheading, and faqs[] differ. The pricing FAQ intentionally
          omits the trailingNote prop — the page already has a final CTA
          + booking links nearby, so the homepage's "Talk to the team"
          line would be redundant here. */}
      <FAQSection
        heading="Pricing questions, answered"
        subheading="Trial, billing, and plan changes."
        faqs={PRICING_FAQS}
      />

      {/* Final CTA */}
      <section className="py-24 lg:py-36 px-6 sm:px-10 lg:px-20 text-center border-t border-m-border-soft bg-m-charcoal">
        <motion.h2
          {...fadeBlur}
          className="font-serif text-[36px] sm:text-[48px] lg:text-[56px] font-normal leading-[1.12] tracking-[-0.01em] text-white mb-10 italic"
        >
          See how Nexpura fits your business
        </motion.h2>
        <motion.div {...fadeUp(0.1)} className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Button href="/signup" size="lg" className="!bg-white !text-m-charcoal hover:!bg-m-champagne-tint">
            Start Free Trial
          </Button>
          <Button href="/contact" variant="tertiary" className="!text-white after:!bg-white">
            Book a Demo
          </Button>
        </motion.div>
        <p className="text-[12px] tracking-[0.16em] uppercase text-m-champagne-soft mt-8 font-medium">
          14 days · Full access · No credit card
        </p>
      </section>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="mt-1.5 shrink-0 text-m-charcoal"
    >
      <path d="M3 7l3 3 5-6" />
    </svg>
  )
}

function ComparisonGroup({ group }: { group: typeof comparisonGroups[number] }) {
  return (
    <>
      <tr className="border-b border-m-border-soft bg-m-ivory">
        <td
          colSpan={4}
          className="py-3 pr-4 pl-0 text-[11px] font-medium tracking-[0.14em] uppercase text-m-text-faint"
        >
          {group.heading}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.key} className="border-b border-m-border-soft-2">
          <td className="py-4 pr-4 text-m-text-primary">{row.key}</td>
          {row.values.map((v, i) => (
            <td
              key={i}
              className={`text-center py-4 px-4 ${v === '—' ? 'text-m-text-faint' : 'text-m-text-secondary'}`}
            >
              {v}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
