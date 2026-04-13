'use client'
import { motion } from 'framer-motion'

const before = [
  'Spreadsheets for inventory and repairs',
  'Generic POS not built for jewellery workflows',
  'No memo/consignment tracking',
  'No digital passport or authenticity certificate',
  'Repairs managed in paper books or WhatsApp',
  'No integrated bespoke order workflow',
  'No AI or smart business insights',
]

const after = [
  'Live inventory across items, stones, and components',
  'POS designed for jewellery retail from the ground up',
  'Full memo and consignment tracking with return date alerts',
  'Digital passports with QR-verifiable authenticity for every piece you sell',
  'Repair tracker with customer notifications built in',
  'Structured bespoke workflow with sign-off at every milestone',
  'AI copilot that answers questions about your own business',
]

export default function LandingComparison() {
  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        <motion.h2
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-16"
        >
          Built for jewellers — not just adapted for them
        </motion.h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white border border-stone-100 rounded-2xl p-8"
          >
            <h3 className="text-[0.9375rem] font-medium text-stone-400 uppercase tracking-wider mb-6">
              The way most jewellers work today
            </h3>
            <ul className="space-y-3">
              {before.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[0.9375rem] text-stone-500">
                  <span className="mt-0.5 text-stone-300 shrink-0 leading-relaxed">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="bg-stone-900 rounded-2xl p-8"
          >
            <h3 className="text-[0.9375rem] font-medium text-stone-400 uppercase tracking-wider mb-6">
              With Nexpura
            </h3>
            <ul className="space-y-3">
              {after.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[0.9375rem] text-stone-200">
                  <span className="mt-0.5 text-stone-400 shrink-0 leading-relaxed">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
