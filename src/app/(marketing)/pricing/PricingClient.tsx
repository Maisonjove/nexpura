'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState } from 'react'

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
    description: 'For single-location independent jewellers.',
    highlights: [
      'Point of Sale, Inventory, Repairs',
      'Bespoke commissions',
      'Customers CRM, Invoicing',
      'AI Business Copilot',
      'Command Centers',
      'Migration Hub',
      '1 staff, 1 store',
    ],
    featured: false,
  },
  {
    name: 'Studio',
    price: 179,
    description: 'For established jewellery businesses ready to scale.',
    highlights: [
      'Everything in Boutique',
      'Full analytics dashboard',
      'Up to 5 staff, up to 3 stores',
      'Website builder',
      'Connect existing website',
      'Custom branding',
    ],
    featured: true,
  },
  {
    name: 'Atelier',
    price: 299,
    description: 'For multi-location groups and high-volume ateliers.',
    highlights: [
      'Everything in Studio',
      'Unlimited staff and stores',
      'AI website copy',
      'Custom analytics',
      'Priority migration support',
      'Dedicated success contact',
    ],
    featured: false,
  },
]

const comparison = [
  { key: 'Point of Sale', values: ['Yes', 'Yes', 'Yes'] },
  { key: 'Inventory management', values: ['Yes', 'Yes', 'Yes'] },
  { key: 'Repairs & Workshop', values: ['Yes', 'Yes', 'Yes'] },
  { key: 'Bespoke commissions', values: ['Yes', 'Yes', 'Yes'] },
  { key: 'Customers CRM', values: ['Yes', 'Yes', 'Yes'] },
  { key: 'Invoicing', values: ['Yes', 'Yes', 'Yes'] },
  { key: 'AI Business Copilot', values: ['Yes', 'Yes', 'Yes'] },
  { key: 'Command Centers', values: ['Yes', 'Yes', 'Yes'] },
  { key: 'Migration Hub', values: ['Yes', 'Yes', 'Yes'] },
  { key: 'Analytics', values: ['Basic', 'Full', 'Full + Custom'] },
  { key: 'Team Size', values: ['1 staff', 'Up to 5', 'Unlimited'] },
  { key: 'Stores', values: ['1', 'Up to 3', 'Unlimited'] },
  { key: 'Website Builder', values: ['—', 'Yes', 'Yes'] },
  { key: 'AI Website Copy', values: ['—', '—', 'Yes'] },
  { key: 'Custom branding', values: ['—', 'Yes', 'Yes'] },
]

const faqs = [
  {
    q: 'Can I change plans later?',
    a: 'Yes — upgrade or downgrade at any time. Changes take effect at the next billing cycle. Upgrades unlock features immediately.',
  },
  {
    q: 'Is there a setup fee?',
    a: 'Never. You only pay the monthly subscription. Migration assistance is included with Studio and Atelier.',
  },
  {
    q: "What's included in the free trial?",
    a: 'Full access to every feature in your chosen plan for 14 days. No credit card required.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes — annual billing gives you two months free. Enable it in billing settings after signup.',
  },
]

export default function PricingClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="pt-20 pb-20 lg:pt-28 lg:pb-24 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p
            {...fadeUp()}
            className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-6"
          >
            Pricing
          </motion.p>
          <motion.h1
            {...fadeBlur}
            className="font-serif text-4xl sm:text-5xl lg:text-[clamp(2.75rem,5vw,4.25rem)] font-normal leading-[1.08] tracking-[-0.01em] text-stone-900 mb-7"
          >
            Transparent <em className="italic">by design</em>
          </motion.h1>
          <motion.p
            {...fadeUp(0.3)}
            className="text-base lg:text-lg leading-relaxed text-stone-500 max-w-[600px] mx-auto"
          >
            No hidden fees. No per-transaction cuts. Choose the plan that fits your
            business and scale when you&apos;re ready.
          </motion.p>
          <motion.p
            {...fadeUp(0.45)}
            className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mt-8"
          >
            14-day free trial &middot; No credit card required
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
              className={`relative flex flex-col p-8 lg:p-10 border ${
                plan.featured
                  ? 'border-stone-900 bg-stone-50'
                  : 'border-black/[0.08] bg-white'
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-8 px-3 py-1 bg-stone-900 text-white text-[0.625rem] tracking-[0.15em] uppercase">
                  Most Popular
                </span>
              )}
              <h3 className="font-serif text-3xl lg:text-[2rem] text-stone-900 mb-2">
                {plan.name}
              </h3>
              <p className="text-[0.875rem] leading-relaxed text-stone-500 mb-8 min-h-[2.5em]">
                {plan.description}
              </p>

              <div className="mb-8 flex items-baseline gap-2">
                <span className="font-serif text-5xl lg:text-6xl text-stone-900">
                  ${plan.price}
                </span>
                <span className="text-[0.875rem] text-stone-400">/ month</span>
              </div>

              <Link
                href="/signup"
                className={`w-full text-center py-3.5 mb-10 text-[0.875rem] font-medium transition-colors duration-300 ${
                  plan.featured
                    ? 'bg-stone-900 text-white hover:bg-stone-800'
                    : 'border border-stone-900 text-stone-900 hover:bg-stone-900 hover:text-white'
                }`}
              >
                Start Free Trial
              </Link>

              <ul className="space-y-3 flex-1">
                {plan.highlights.map((h) => (
                  <li
                    key={h}
                    className="flex items-start gap-3 text-[0.875rem] text-stone-600"
                  >
                    <span className="mt-2 w-1 h-1 rounded-full bg-stone-900 flex-shrink-0" />
                    {h}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-20 lg:py-32 px-6 sm:px-10 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <motion.p
              {...fadeUp()}
              className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-4"
            >
              Compare Plans
            </motion.p>
            <motion.h2
              {...fadeBlur}
              className="font-serif text-3xl sm:text-4xl lg:text-[3rem] font-normal leading-[1.1] tracking-[-0.01em] text-stone-900"
            >
              Every detail, side by side.
            </motion.h2>
          </div>

          <motion.div {...fadeUp(0.1)} className="overflow-x-auto">
            <table className="w-full text-[0.875rem]">
              <thead>
                <tr className="border-b border-stone-900">
                  <th className="text-left py-4 pr-4 text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 font-normal">
                    Feature
                  </th>
                  {plans.map((p) => (
                    <th
                      key={p.name}
                      className="text-center py-4 px-4 font-serif text-lg text-stone-900 font-normal"
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-stone-100"
                  >
                    <td className="py-4 pr-4 text-stone-700">{row.key}</td>
                    {row.values.map((v, i) => (
                      <td
                        key={i}
                        className="text-center py-4 px-4 text-stone-500"
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 lg:py-32 px-6 sm:px-10 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-[820px] mx-auto">
          <div className="text-center mb-16">
            <motion.p
              {...fadeUp()}
              className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-4"
            >
              Questions
            </motion.p>
            <motion.h2
              {...fadeBlur}
              className="font-serif text-3xl sm:text-4xl lg:text-[3rem] font-normal leading-[1.1] tracking-[-0.01em] text-stone-900"
            >
              Common questions, answered.
            </motion.h2>
          </div>

          <div className="divide-y divide-stone-200 border-y border-stone-200">
            {faqs.map((faq, i) => (
              <motion.div key={faq.q} {...fadeUp(i * 0.05)}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-6 py-6 text-left cursor-pointer group"
                >
                  <span className="font-serif text-lg lg:text-xl text-stone-900">
                    {faq.q}
                  </span>
                  <span
                    className={`text-stone-400 text-2xl transition-transform duration-300 flex-shrink-0 ${
                      openFaq === i ? 'rotate-45' : ''
                    }`}
                  >
                    +
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-500 ease-out ${
                    openFaq === i ? 'max-h-40 pb-6' : 'max-h-0'
                  }`}
                >
                  <p className="text-[0.9375rem] leading-relaxed text-stone-500 max-w-[680px]">
                    {faq.a}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-36 px-6 sm:px-10 lg:px-20 text-center border-t border-black/[0.06]">
        <motion.h2
          {...fadeBlur}
          className="font-serif text-3xl sm:text-4xl lg:text-[3.75rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-10 italic"
        >
          Start your free trial today.
        </motion.h2>
        <motion.div {...fadeUp(0.1)} className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link
            href="/signup"
            className="
              inline-flex items-center justify-center
              min-w-[180px] px-10 py-4 md:min-w-[200px] md:px-12
              bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]
              rounded-full
              shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]
              transition-shadow duration-400
              hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]
              relative overflow-hidden cursor-pointer
            "
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
            <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">
              Get started free
            </span>
          </Link>
          <Link
            href="/contact"
            className="text-[0.9375rem] text-stone-700 underline underline-offset-4 hover:opacity-60 transition-opacity duration-300"
          >
            Talk to sales
          </Link>
        </motion.div>
        <p className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mt-8">
          14 days &middot; Full access &middot; No credit card
        </p>
      </section>
    </div>
  )
}
