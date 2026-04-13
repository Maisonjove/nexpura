'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

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

const sections = [
  {
    title: 'Your data is yours',
    body: 'Customer records, inventory, repair history, bespoke orders, and financial data are stored with care and not shared with third parties for commercial purposes.',
  },
  {
    title: 'Access that fits your team',
    body: 'Staff access is managed by role. You control who sees what, based on their role or location.',
  },
  {
    title: 'Reliable infrastructure',
    body: 'Nexpura runs on modern cloud infrastructure designed for availability and resilience.',
  },
  {
    title: 'Privacy by design',
    body: 'Your customer and business data is handled with discretion. We do not use your data for advertising purposes or share it with third parties.',
  },
  {
    title: 'Built with care',
    body: 'The platform is developed with attention to stability, access control, and risk reduction.',
  },
]

export default function SecurityClient() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="pt-20 pb-24 lg:pt-28 lg:pb-32 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p
            {...fadeUp()}
            className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-6"
          >
            Security
          </motion.p>
          <motion.h1
            {...fadeBlur}
            className="font-serif text-4xl sm:text-5xl lg:text-[clamp(2.75rem,5vw,4.25rem)] font-normal leading-[1.15] tracking-[-0.01em] text-stone-900 mb-7"
          >
            Your data, <em className="italic">protected</em>
          </motion.h1>
          <motion.p
            {...fadeUp(0.3)}
            className="text-base lg:text-lg leading-relaxed text-stone-500 max-w-[600px] mx-auto"
          >
            Nexpura is built for jewellery businesses that handle sensitive customer records, inventory data, and financial information every day.
          </motion.p>
        </div>
      </section>

      {/* Sections */}
      <section className="py-20 lg:py-32 px-6 sm:px-10 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-[800px] mx-auto">
          {sections.map((section, i) => (
            <motion.div
              key={section.title}
              {...fadeUp(i * 0.1)}
              className="py-10 border-b border-stone-100 last:border-b-0 first:pt-0"
            >
              <h2 className="font-serif text-2xl lg:text-3xl text-stone-900 mb-4">
                {section.title}
              </h2>
              <p className="text-[0.9375rem] lg:text-base leading-relaxed text-stone-500">
                {section.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-36 px-6 sm:px-10 lg:px-20 text-center border-t border-black/[0.06]">
        <motion.h2
          {...fadeBlur}
          className="font-serif text-3xl sm:text-4xl lg:text-[3rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-6"
        >
          Questions about security?
        </motion.h2>
        <motion.p
          {...fadeUp(0.1)}
          className="text-base lg:text-lg leading-relaxed text-stone-500 max-w-[500px] mx-auto mb-10"
        >
          If you have specific requirements or questions about how we handle your data, get in touch.
        </motion.p>
        <motion.div {...fadeUp(0.2)}>
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
              Contact Us
            </span>
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
