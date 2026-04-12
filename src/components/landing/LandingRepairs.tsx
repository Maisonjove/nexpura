'use client'
import { motion } from 'framer-motion'

const points = [
  'Log every repair at intake — customer, item, issue, photos, agreed price.',
  'Assign to a staff member or bench jeweller in one click.',
  'Customer gets a live tracking link — no more "is it ready?" calls.',
  'Status updates: Received → In Workshop → Ready for Pickup → Collected.',
  'Staff see all open jobs, deadlines, and priorities in one view.',
  'Nothing slips. Nothing gets lost. Everyone knows where every piece is.',
]

export default function LandingRepairs() {
  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <motion.h2
            initial={{ opacity: 0, filter: 'blur(6px)' }}
            whileInView={{ opacity: 1, filter: 'blur(0px)' }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 mb-6"
          >
            The repair tracker your customers actually appreciate.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="text-stone-500 text-[0.9375rem] leading-relaxed mb-8"
          >
            Every repair logged, assigned, tracked, and communicated — from intake to collection.
          </motion.p>
          <ul className="space-y-4">
            {points.map((point, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 + i * 0.07 }}
                className="flex items-start gap-3 text-[0.9375rem] text-stone-600 leading-relaxed"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                {point}
              </motion.li>
            ))}
          </ul>
        </div>
        <motion.div
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          className="bg-stone-100 rounded-2xl aspect-video flex items-center justify-center p-8 text-center"
        >
          <div>
            <p className="text-stone-400 text-sm font-medium mb-2">[ Repair Tracker Screenshot ]</p>
            <p className="text-stone-300 text-xs">Placeholder — replace with real asset</p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
