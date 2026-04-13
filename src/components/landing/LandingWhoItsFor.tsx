'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'

const segments = [
  { title: 'Retail Jewellers', description: 'Connected POS, inventory, CRM, and invoicing for jewellery retail.', cta: 'See retail workflows', href: '/features' },
  { title: 'Workshops & Repairs', description: 'Track repairs, commissions, deadlines, and customer updates in one place.', cta: 'See repair workflows', href: '/features#repairs' },
  { title: 'Bespoke Studios', description: 'Run custom orders with approvals, milestones, sourcing, and deposits.', cta: 'See bespoke workflows', href: '/features#bespoke' },
  { title: 'Multi-Store Groups', description: 'Shared customer data, stock visibility, and reporting across locations.', cta: 'See multi-store workflows', href: '/features' },
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
        Built for every corner of the jewellery trade
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="text-center text-stone-500 text-[0.9375rem] mb-16 max-w-xl mx-auto"
      >
        Whether you sell, repair, create to order, or manage multiple locations, Nexpura fits the workflows generic systems leave disconnected.
      </motion.p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-[1200px] mx-auto">
        {segments.map((seg, i) => (
          <motion.div
            key={seg.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
            className="bg-white rounded-2xl p-8 border border-stone-100"
          >
            <h3 className="font-serif text-xl text-stone-900 mb-3">{seg.title}</h3>
            <p className="text-[0.9375rem] leading-relaxed text-stone-500 mb-4">{seg.description}</p>
            <Link
              href={seg.href}
              className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900 transition-colors duration-200"
            >
              {seg.cta}
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
