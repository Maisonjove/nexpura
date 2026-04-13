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
      <motion.div
        initial={{ opacity: 0, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, filter: 'blur(0px)' }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center justify-center gap-x-3 sm:gap-x-4 gap-y-3 flex-wrap px-6 sm:px-10 lg:px-20 max-w-[1200px] mx-auto"
      >
        {attributes.map((attr) => (
          <span
            key={attr}
            className="inline-flex items-center px-4 py-2 rounded-full border border-stone-200 bg-stone-50 text-[0.8125rem] font-normal text-stone-600 select-none whitespace-nowrap"
          >
            {attr}
          </span>
        ))}
      </motion.div>
    </section>
  )
}
