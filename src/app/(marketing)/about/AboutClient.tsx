'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const EASE = [0.22, 1, 0.36, 1] as const

// Hero animations use `animate` (not `whileInView`) — above-fold elements are
// already visible on load so whileInView never fires for them.
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
    <div className="bg-white">
      {/* Hero */}
      <section className="pt-20 pb-24 lg:pt-28 lg:pb-32 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p
            {...heroFadeUp()}
            className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-3"
          >
            Our Story
          </motion.p>
          <motion.h1
            {...heroFadeBlur}
            className="font-serif text-4xl sm:text-5xl lg:text-[clamp(2.75rem,5vw,4.25rem)] font-normal leading-[1.15] tracking-[-0.01em] text-stone-900 mb-5"
          >
            Built exclusively <em className="italic">for </em>
            <em className="italic">jewellers</em>
          </motion.h1>
          <motion.p
            {...heroFadeUp(0.3)}
            className="text-base lg:text-lg leading-relaxed text-stone-500 max-w-[600px] mx-auto"
          >
            Nexpura was created for jewellery businesses that outgrow generic retail tools. Repairs are more complex. Bespoke work needs structure. Inventory is more nuanced. Customer relationships are more personal. We built Nexpura to reflect that reality from the ground up.
          </motion.p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 lg:py-32 px-6 sm:px-10 lg:px-20 bg-white border-t border-black/[0.06]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <motion.p
              {...fadeUp()}
              className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-4"
            >
              Our Mission
            </motion.p>
            <motion.h2
              {...fadeBlur}
              className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-8"
            >
              World-class software for independent jewellers.
            </motion.h2>
            <motion.div {...fadeUp(0.1)} className="space-y-5 text-[0.9375rem] leading-relaxed text-stone-500">
              <p>
                Generic retail software was never designed for the way jewellers actually operate. Nexpura brings repairs, bespoke workflows, inventory, customer records, invoicing, and digital trust tools into one connected system built specifically for the trade.
              </p>
            </motion.div>
          </div>

          <motion.div
            {...fadeUp(0.2)}
            className="grid grid-cols-2 gap-px bg-black/[0.06] border border-black/[0.06]"
          >
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-white p-5 lg:p-6 flex flex-col items-start gap-2 transition-colors duration-200 hover:bg-stone-50"
              >
                <span className="font-serif text-4xl lg:text-5xl text-stone-900">
                  {stat.value}
                </span>
                <span className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-500">
                  {stat.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 lg:py-32 px-6 sm:px-10 lg:px-20 bg-white border-t border-black/[0.06]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16 lg:mb-20">
            <motion.p
              {...fadeUp()}
              className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-4"
            >
              What We Stand For
            </motion.p>
            <motion.h2
              {...fadeBlur}
              className="font-serif text-3xl sm:text-4xl lg:text-[3rem] font-normal leading-[1.1] tracking-[-0.01em] text-stone-900"
            >
              Principles that guide every line of code.
            </motion.h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-8">
            {values.map((v, i) => (
              <motion.div key={v.title} {...fadeUp(i * 0.1)} className="flex flex-col">
                <span className="text-sm tabular-nums text-stone-300 font-medium mb-2">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-serif text-xl lg:text-2xl text-stone-900 mb-3">
                  {v.title}
                </h3>
                <p className="text-[0.9375rem] leading-relaxed text-stone-500 max-w-[280px]">
                  {v.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-24 px-6 sm:px-10 lg:px-20 text-center border-t border-black/[0.06]">
        <motion.h2
          {...fadeBlur}
          className="font-serif text-3xl sm:text-4xl lg:text-[3.75rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-4"
        >
          See how Nexpura fits your business
        </motion.h2>
        <p className="text-[0.9375rem] text-stone-500 mb-10 max-w-md mx-auto">
          Explore the platform in a personalised walkthrough built around your workflow.
        </p>
        <motion.div {...fadeUp(0.1)} className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link
            href="/contact"
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
              Book a Demo
            </span>
          </Link>
          <Link
            href="/platform"
            className="text-[0.9375rem] text-stone-700 underline underline-offset-4 hover:opacity-60 transition-opacity duration-300"
          >
            See the Platform
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
