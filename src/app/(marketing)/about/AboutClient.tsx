'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const EASE = [0.22, 1, 0.36, 1] as const

// ─── HERO animations (above-fold) ────────────────────────────────────────────
// Uses `animate` (not `whileInView`) so elements that are already visible on
// page load actually animate in. `whileInView` only fires when an element
// *enters* the viewport during scroll, which never happens for above-fold
// content — leaving hero elements permanently invisible (opacity: 0).
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

// ─── SCROLL animations (below-fold) ──────────────────────────────────────────
// These correctly use `whileInView` — they are off-screen on load and should
// animate in as the user scrolls down.
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
  { value: '500+', label: 'Jewellers Served' },
  { value: '12', label: 'Countries' },
  { value: '5+', label: 'Years Building' },
  { value: '4.9☁', label: 'Customer Rating' },
]

const values = [
  {
    title: 'Craft over compromise',
    desc: 'We build deep, purpose-built features for jewellers — not watered-down adaptations of generic retail software.',
  },
  {
    title: 'Your data, your business',
    desc: 'We never sell your data. Your customers, inventory, and business intelligence belong to you — always.',
  },
  {
    title: 'Partner, not vendor',
    desc: "We succeed when you succeed. That's why we offer white-glove migration, hands-on onboarding, and a team that picks up the phone.",
  },
]

export default function AboutClient() {
  return (
    <div className="bg-white">
      {/* Hero — uses heroFadeBlur / heroFadeUp so content is visible on load */}
      <section className="pt-20 pb-24 lg:pt-28 lg:pb-32 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p
            {...heroFadeUp()}
            className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-6"
          >
            Our Story
          </motion.p>

          <motion.h1
            {...heroFadeBlur}
            className="font-serif text-4xl sm:text-5xl lg:text-[clamp(2.75rem,5vw,4.25rem)] font-normal leading-[1.15] tracking-[-0.01em] text-stone-900 mb-7"
          >
            Built exclusively{' '}
            <em className="italic">for </em>
            <span className="relative inline-block isolate align-baseline">
              {/* Cloud-like grainy gradient behind the word */}
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-x-[12%] -inset-y-[35%] -z-10"
              >
                <span
                  className="absolute inset-0 animate-[blobShift_18s_ease-in-out_infinite]"
                  style={{
                    background:
                      'radial-gradient(45% 55% at 40% 50%, rgba(196,168,130,0.85) 0%, rgba(139,115,85,0.45) 35%, rgba(139,115,85,0.12) 60%, transparent 78%), radial-gradient(40% 50% at 70% 55%, rgba(212,184,134,0.7) 0%, rgba(196,168,130,0.35) 40%, transparent 75%)',
                    filter: 'blur(14px)',
                  }}
                />
                <span
                  className="absolute inset-0 mix-blend-overlay opacity-[0.5]"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.9'/></svg>\")",
                    WebkitMaskImage:
                      'radial-gradient(50% 60% at 50% 50%, #000 0%, rgba(0,0,0,0.7) 35%, rgba(0,0,0,0.2) 65%, transparent 82%)',
                    maskImage:
                      'radial-gradient(50% 60% at 50% 50%, #000 0%, rgba(0,0,0,0.7) 35%, rgba(0,0,0,0.2) 65%, transparent 82%)',
                  }}
                />
              </span>
              <em className="italic relative text-stone-900">jewellers</em>
            </span>
          </motion.h1>

          <motion.p
            {...heroFadeUp(0.3)}
            className="text-base lg:text-lg leading-relaxed text-stone-500 max-w-[600px] mx-auto"
          >
            Nexpura was created by people who understand the unique challenges of running a
            jewellery business — from complex repairs to precious metal inventory, lasting customer
            relationships, and growing a beautiful brand.
          </motion.p>
        </div>
      </section>

      {/* Mission — below fold, uses whileInView */}
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
                For too long, the industry has relied on outdated, generic retail tools that
                don&apos;t understand the nuances of jewellery — the intricacy of repairs, the
                craftsmanship of bespoke commissions, the provenance of fine gemstones.
              </p>
              <p>
                Nexpura changes that. We&apos;ve built every feature from the ground up with
                jewellers in mind — from the way repairs flow through your workshop, to how you
                present beautiful digital passports to your clients, to how you manage
                multi-location inventory with precision.
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
                className="bg-white p-8 lg:p-10 flex flex-col items-start gap-2"
              >
                <span className="font-serif text-4xl lg:text-5xl text-stone-900">
                  {stat.value}
                </span>
                <span className="text-[0.75rem] tracking-[0.15em] uppercase text-stone-400">
                  {stat.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Values — below fold */}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-10">
            {values.map((v, i) => (
              <motion.div key={v.title} {...fadeUp(i * 0.1)} className="flex flex-col">
                <span className="text-sm tabular-nums text-stone-300 font-medium mb-4">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-serif text-xl lg:text-2xl text-stone-900 mb-3">
                  {v.title}
                </h3>
                <p className="text-[0.9375rem] leading-relaxed text-stone-500">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — below fold */}
      <section className="py-20 lg:py-36 px-6 sm:px-10 lg:px-20 text-center border-t border-black/[0.06]">
        <motion.h2
          {...fadeBlur}
          className="font-serif text-3xl sm:text-4xl lg:text-[3.75rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-10 italic"
        >
          Ready to transform <br /> your jewellery business?
        </motion.h2>
        <motion.div
          {...fadeUp(0.1)}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center"
        >
          <Link
            href="/signup"
            className="inline-flex items-center justify-center min-w-[180px] px-10 py-4 md:min-w-[200px] md:px-12 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] transition-shadow duration-400 hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] relative overflow-hidden cursor-pointer"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
            <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">
              Start Free Trial
            </span>
          </Link>
          <Link
            href="/contact"
            className="text-[0.9375rem] text-stone-700 underline underline-offset-4 hover:opacity-60 transition-opacity duration-300"
          >
            Get in touch
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
