'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import Button from '@/components/landing/ui/Button'

/**
 * Pricing page restyled to the homepage system per Kaitlyn brief #2
 * Section 10B. Structure, content, prices, plan names, feature lists,
 * comparison table rows, FAQ copy — all preserved verbatim. Only the
 * visual layer is brought in line with the marketing tokens:
 *  - Page bg #FFFFFF → bg-m-ivory.
 *  - Plan cards use the standard card surface; featured plan is the
 *    one with a champagne border (was charcoal). 32px desktop /
 *    22px mobile padding meets the spacing token minimum.
 *  - Plan CTA buttons swap to the Button component (primary on the
 *    featured plan, secondary on the others) so heights, hover lift,
 *    radius, and focus ring all match every other CTA on the site.
 *  - Comparison table + FAQ accordion + final CTA all swap stone-*
 *    palette for the m-* tokens. FAQ accordion already had the +
 *    → × rotation Kaitlyn called for; only colours change.
 *  - Final CTA's bespoke heavy-shadow gradient pill is dropped for
 *    the standard primary Button. Tertiary "Explore the Platform"
 *    link uses the underline-grow tertiary variant.
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

const plans = [
  {
    name: 'Boutique',
    price: 89,
    description:
      'For single-store jewellers who need one connected system for sales, repairs, bespoke, and stock.',
    cta: 'Start Free Trial',
    ctaHref: '/signup',
    highlights: [
      'POS, inventory, repairs, and bespoke workflows',
      'Customers CRM and invoicing',
      'Command Centers and AI Copilot',
      'Guided migration included',
      '1 staff · 1 store',
    ],
    featured: false,
  },
  {
    name: 'Studio',
    price: 179,
    description:
      'For growing jewellery businesses that need deeper reporting, branding, and team visibility across locations.',
    cta: 'Book a Demo',
    ctaHref: '/contact',
    highlights: [
      'Everything in Boutique',
      'Full analytics dashboard',
      'Up to 5 staff · up to 3 stores',
      'Custom branding',
      'Website and digital presence tools',
    ],
    featured: true,
  },
  {
    name: 'Atelier',
    price: 299,
    description:
      'For multi-store jewellery businesses and high-volume workshops needing advanced support, analytics, and scale.',
    cta: 'Talk to Sales',
    ctaHref: '/contact',
    highlights: [
      'Everything in Studio',
      'Unlimited staff and stores',
      'Custom analytics',
      'AI product descriptions',
      'Priority migration support',
      'Dedicated success contact',
    ],
    featured: false,
  },
]

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

const faqs = [
  {
    q: 'Can I change plans later?',
    a: 'Yes. Upgrade or downgrade at any time. Changes take effect at the next billing cycle. Upgrades apply immediately.',
  },
  {
    q: 'Is there a setup fee?',
    a: 'Never. You only pay the monthly subscription. Free migration is included with every plan.',
  },
  {
    q: "What's included in the free trial?",
    a: 'Full access to every feature in your chosen plan for 14 days. No credit card required.',
  },
  {
    q: 'Do you offer annual billing?',
    a: "Yes — annual billing gives you two months free. We can help you set it up when you're ready.",
  },
]

export default function PricingClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

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
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              {...fadeUp(i * 0.1)}
              className={`relative flex flex-col p-[22px] sm:p-8 lg:p-10 rounded-[18px] border transition-all duration-[250ms] [transition-timing-function:var(--m-ease)] ${
                plan.featured
                  ? 'border-m-champagne bg-m-white-soft shadow-[0_18px_45px_rgba(0,0,0,0.06)]'
                  : 'border-m-border-soft bg-m-white-soft hover:-translate-y-1 hover:border-m-border-hover hover:shadow-[0_18px_45px_rgba(0,0,0,0.06)]'
              }`}
            >
              {plan.featured && (
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

              <div className="mb-8 flex items-baseline gap-2">
                <span className="font-serif text-[48px] lg:text-[56px] text-m-charcoal leading-none">
                  ${plan.price}
                </span>
                <span className="text-[14px] text-m-text-faint">/ month</span>
              </div>

              <Button
                href={plan.ctaHref}
                variant={plan.featured ? 'primary' : 'secondary'}
                fullWidth
                className="mb-10"
              >
                {plan.cta}
              </Button>

              <ul className="space-y-3 flex-1">
                {plan.highlights.map((h) => (
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
          ))}
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
                  {plans.map((p) => (
                    <th
                      key={p.name}
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

      {/* FAQ */}
      <section className="py-20 lg:py-32 px-6 sm:px-10 lg:px-20 border-t border-m-border-soft">
        <div className="max-w-[820px] mx-auto">
          <div className="text-center mb-16">
            <motion.p
              {...fadeUp()}
              className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-4"
            >
              Questions
            </motion.p>
            <motion.h2
              {...fadeBlur}
              className="font-serif text-[36px] sm:text-[44px] lg:text-[48px] font-normal leading-[1.12] tracking-[-0.01em] text-m-charcoal"
            >
              Common questions, answered
            </motion.h2>
          </div>

          <div className="divide-y divide-m-border-soft border-y border-m-border-soft">
            {faqs.map((faq, i) => (
              <motion.div key={faq.q} {...fadeUp(i * 0.05)}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  className="w-full flex items-center justify-between gap-6 py-6 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne focus-visible:ring-offset-2 rounded"
                >
                  <span className="font-sans font-semibold text-[18px] lg:text-[20px] text-m-charcoal">
                    {faq.q}
                  </span>
                  <span
                    aria-hidden
                    className={`text-m-text-faint text-[24px] transition-transform duration-300 [transition-timing-function:var(--m-ease)] flex-shrink-0 leading-none ${
                      openFaq === i ? 'rotate-45' : ''
                    }`}
                  >
                    +
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-[400ms] [transition-timing-function:var(--m-ease)] ${
                    openFaq === i ? 'max-h-40 pb-6' : 'max-h-0'
                  }`}
                >
                  <p className="text-[15px] leading-[1.6] text-m-text-secondary max-w-[680px]">
                    {faq.a}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

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
