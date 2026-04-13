'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function LandingCta() {
  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20 text-center">
      <motion.h2
        initial={{ opacity: 0, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, filter: 'blur(0px)' }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="font-serif text-3xl sm:text-4xl lg:text-[3.75rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-10 italic"
      >
        See how Nexpura fits your business
      </motion.h2>
      <motion.div
        initial={{ opacity: 0, filter: 'blur(4px)', y: 16 }}
        whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
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
              active:shadow-[0_1px_2px_rgba(0,0,0,0.25),0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]
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
            className="
              inline-flex items-center justify-center
              min-w-[180px] px-10 py-4 md:min-w-[200px] md:px-12
              bg-white
              border border-stone-200
              rounded-full
              shadow-[0_2px_4px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.06)]
              transition-all duration-400
              hover:border-stone-300 hover:shadow-[0_4px_8px_rgba(0,0,0,0.06),0_8px_20px_rgba(0,0,0,0.08)]
              active:shadow-[0_1px_2px_rgba(0,0,0,0.04)]
              cursor-pointer
            "
          >
            <span className="text-base font-medium text-stone-900 tracking-[0.01em]">
              See the Platform
            </span>
          </Link>
        </div>
        <p className="text-sm text-stone-400 mt-2">
          30 minutes · Personalised walkthrough · Migration included
        </p>
      </motion.div>
    </section>
  )
}
