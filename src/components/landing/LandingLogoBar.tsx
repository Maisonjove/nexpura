'use client'

import { motion } from 'framer-motion'

const attributes = [
  'Built for jewellers',
  'Free guided migration',
  'No hidden fees',
  '14-day trial',
]

export default function LandingLogoBar() {
  return (
    <section className="bg-white py-16">
      <motion.p
        initial={{ opacity: 0, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, filter: 'blur(0px)' }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="text-center text-[0.8125rem] font-normal tracking-[0.15em] uppercase text-stone-400 mb-10"
      >
        Made for jewellers who need more than a generic system
      </motion.p>
      <motion.div
        initial={{ opacity: 0, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, filter: 'blur(0px)' }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="flex items-center justify-center gap-x-6 sm:gap-x-10 lg:gap-x-14 gap-y-4 flex-wrap px-6 sm:px-10 lg:px-20 max-w-[1200px] mx-auto"
      >
        {attributes.map((attr) => (
          <span
            key={attr}
            className="flex items-center gap-2 text-[0.875rem] text-stone-600 select-none whitespace-nowrap"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
            {attr}
          </span>
        ))}
      </motion.div>
    </section>
  )
}
