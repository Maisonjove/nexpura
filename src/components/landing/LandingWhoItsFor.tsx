'use client'
import { motion } from 'framer-motion'

const segments = [
  { emoji: '💍', title: 'Retail Jewellers', description: 'A complete POS, inventory, and CRM built for jewellery retail. Spend less time on admin, more time with customers.' },
  { emoji: '🔨', title: 'Workshops & Ateliers', description: 'Track every commission, job, and deadline in one place. No more paper logs or spreadsheet chaos.' },
  { emoji: '🏪', title: 'Multi-Store Groups', description: 'Unified stock visibility, shared customer profiles, and per-location reporting across all your stores.' },
  { emoji: '🔧', title: 'Repair-Heavy Businesses', description: 'Log every repair properly, keep staff accountable, and give customers live status without the calls.' },
  { emoji: '✏️', title: 'Bespoke-Focused Studios', description: 'A 12-stage custom order workflow with client approvals, stone sourcing, and clear delivery milestones.' },
]

export default function LandingWhoItsFor() {
  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <motion.h2
        initial={{ opacity: 0, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, filter: 'blur(0px)' }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-4"
      >
        Built for every corner of the jewellery trade.
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="text-center text-stone-500 text-[0.9375rem] mb-16 max-w-xl mx-auto"
      >
        Whether you run a single-room studio or a group of stores, Nexpura fits the way you work.
      </motion.p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-[1200px] mx-auto">
        {segments.map((seg, i) => (
          <motion.div
            key={seg.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
            className="bg-white rounded-2xl p-8 border border-stone-100"
          >
            <div className="text-3xl mb-4">{seg.emoji}</div>
            <h3 className="font-serif text-xl text-stone-900 mb-3">{seg.title}</h3>
            <p className="text-[0.9375rem] leading-relaxed text-stone-500">{seg.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
