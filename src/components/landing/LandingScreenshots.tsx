'use client'
import { motion } from 'framer-motion'

const screens = [
  'Dashboard Overview',
  'Repair Tracker',
  'Inventory View',
  'Bespoke Order Timeline',
  'Digital Passport',
  'Analytics Dashboard',
]

export default function LandingScreenshots() {
  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        <motion.h2
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-4"
        >
          See Nexpura in action.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.1 }}
          className="text-center text-stone-500 text-[0.9375rem] mb-16 max-w-xl mx-auto"
        >
          Real screenshots coming soon. Placeholders below — replace with final assets.
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {screens.map((label, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 }}
              className="bg-stone-100 rounded-2xl aspect-video flex flex-col items-center justify-center p-6 text-center"
            >
              <p className="text-stone-500 text-sm font-medium mb-1">{label}</p>
              <p className="text-stone-300 text-xs">[ Screenshot placeholder — replace with real asset ]</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
