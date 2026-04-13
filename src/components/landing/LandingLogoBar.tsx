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
        className="flex items-center justify-center gap-x-5 gap-y-2 flex-wrap px-6 sm:px-10 lg:px-20 max-w-[1200px] mx-auto"
      >
        {attributes.map((attr, i) => (
          <span key={attr} className="flex items-center gap-5">
            <span className="text-[0.8125rem] font-normal text-stone-400 tracking-wide whitespace-nowrap">
              {attr}
            </span>
            {i < attributes.length - 1 && (
              <span className="text-stone-300 select-none">·</span>
            )}
          </span>
        ))}
      </motion.div>
    </section>
  )
}
