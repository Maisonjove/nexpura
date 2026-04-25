'use client'

import { motion } from 'framer-motion'
import Button from '@/components/landing/ui/Button'

/**
 * About page restyled to the homepage system per Kaitlyn brief #2
 * Section 10G. Copy, mission text, stats, values, structure all
 * preserved verbatim — only the visual layer is brought in line with
 * the m-* token system + standard Button.
 */

const EASE = [0.22, 1, 0.36, 1] as const

const heroFadeBlur = {
  initial: { opacity: 0, filter: 'blur(6px)' },
  animate: { opacity: 1, filter: 'blur(0px)' },
  transition: { duration: 1.2, ease: EASE },
}

const heroFadeUp = (delay = 0) => ({
  initial: { opacity: 0, filter: 'blur(4px)', y: 16 },
  animate: { opacity: 1, filter: 'blur(0px)', y: 0 },
  transition: { duration: 1.2, ease: EASE, delay },
})

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

const stats = [
  { value: 'Repairs', label: 'Tracked end to end' },
  { value: 'Bespoke', label: 'Structured commission workflow' },
  { value: 'Inventory', label: 'Real time visibility' },
  { value: 'Migration', label: 'Guided with every plan' },
]

const values = [
  {
    title: 'Craft over compromise',
    desc: 'We build purpose-built features for jewellers — not watered-down versions of generic retail software.',
  },
  {
    title: 'Your data, your business',
    desc: 'Your customers, inventory, and business intelligence belong to you — always.',
  },
  {
    title: 'Partner, not vendor',
    desc: 'We support implementation with guided migration, onboarding, and real human help when you need it.',
  },
]

export default function AboutClient() {
  return (
    <div className="bg-m-ivory">
      {/* Hero */}
      <section className="pt-24 pb-24 lg:pt-32 lg:pb-32 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p
            {...heroFadeUp()}
            className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-3"
          >
            Our Story
          </motion.p>
          <motion.h1
            {...heroFadeBlur}
            className="font-serif text-[42px] sm:text-[56px] lg:text-[clamp(2.75rem,5vw,4.5rem)] font-normal leading-[1.06] tracking-[-0.015em] text-m-charcoal mb-5"
          >
            Built exclusively <em className="italic">for </em>
            <em className="italic">jewellers</em>
          </motion.h1>
          <motion.p
            {...heroFadeUp(0.3)}
            className="text-[16px] sm:text-[18px] leading-[1.55] text-m-text-secondary max-w-[600px] mx-auto"
          >
            Nexpura was created for jewellery businesses that outgrow generic retail tools. Repairs are more complex. Bespoke work needs structure. Inventory is more nuanced. Customer relationships are more personal. We built Nexpura to reflect that reality from the ground up.
          </motion.p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 lg:py-32 px-6 sm:px-10 lg:px-20 bg-m-white-soft border-t border-m-border-soft">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <motion.p
              {...fadeUp()}
              className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-4"
            >
              Our Mission
            </motion.p>
            <motion.h2
              {...fadeBlur}
              className="font-serif text-[36px] sm:text-[44px] lg:text-[48px] font-normal leading-[1.12] tracking-[-0.01em] text-m-charcoal mb-8"
            >
              World-class software for independent jewellers.
            </motion.h2>
            <motion.div {...fadeUp(0.1)} className="space-y-5 text-[16px] leading-[1.6] text-m-text-secondary">
              <p>
                Generic retail software was never designed for the way jewellers actually operate. Nexpura brings repairs, bespoke workflows, inventory, customer records, invoicing, and digital trust tools into one connected system built specifically for the trade.
              </p>
            </motion.div>
          </div>

          <motion.div
            {...fadeUp(0.2)}
            className="grid grid-cols-2 gap-px bg-m-border-soft border border-m-border-soft rounded-[18px] overflow-hidden"
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-m-white-soft p-5 lg:p-8 flex flex-col items-start gap-2 transition-colors duration-200 hover:bg-m-warm-tint"
              >
                <span className="font-serif text-[36px] lg:text-[44px] text-m-charcoal leading-none">
                  {stat.value}
                </span>
                <span className="text-[11px] tracking-[0.14em] uppercase text-m-text-faint font-medium">
                  {stat.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 lg:py-32 px-6 sm:px-10 lg:px-20 border-t border-m-border-soft">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16 lg:mb-20">
            <motion.p
              {...fadeUp()}
              className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-4"
            >
              What We Stand For
            </motion.p>
            <motion.h2
              {...fadeBlur}
              className="font-serif text-[36px] sm:text-[44px] lg:text-[48px] font-normal leading-[1.12] tracking-[-0.01em] text-m-charcoal"
            >
              Principles that guide every line of code.
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {values.map((v, i) => (
              <motion.div key={v.title} {...fadeUp(i * 0.1)} className="flex flex-col">
                <span className="text-[14px] tabular-nums text-m-champagne font-medium mb-3">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-serif text-[22px] lg:text-[24px] text-m-charcoal mb-3 leading-[1.25]">
                  {v.title}
                </h3>
                <p className="text-[15px] leading-[1.6] text-m-text-secondary max-w-[300px]">
                  {v.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 lg:py-36 px-6 sm:px-10 lg:px-20 text-center border-t border-m-border-soft bg-m-charcoal">
        <motion.h2
          {...fadeBlur}
          className="font-serif text-[36px] sm:text-[48px] lg:text-[56px] font-normal leading-[1.12] tracking-[-0.01em] text-white mb-4"
        >
          See how Nexpura fits your business
        </motion.h2>
        <p className="text-[15px] text-m-champagne-soft mb-10 max-w-md mx-auto">
          Explore the platform in a personalised walkthrough built around your workflow.
        </p>
        <motion.div {...fadeUp(0.1)} className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Button href="/signup" size="lg" className="!bg-white !text-m-charcoal hover:!bg-m-champagne-tint">
            Start Free Trial
          </Button>
          <Button href="/contact" variant="tertiary" className="!text-white after:!bg-white">
            Book a Demo
          </Button>
        </motion.div>
      </section>
    </div>
  )
}
