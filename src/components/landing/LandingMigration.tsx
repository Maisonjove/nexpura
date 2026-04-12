'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'

const steps = [
  {
    n: '01',
    title: 'We audit your current setup',
    body: 'Tell us what you use. We assess your data, structure, and workflow.',
  },
  {
    n: '02',
    title: 'We migrate your data',
    body: 'Customer records, inventory, repair history, supplier contacts — we handle it.',
  },
  {
    n: '03',
    title: 'We train your team',
    body: 'Live onboarding, video walkthroughs, and ongoing support. You are never alone.',
  },
]

export default function LandingMigration() {
  return (
    <section id="migration" className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        <motion.h2
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-4"
        >
          Switch without the stress.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.1 }}
          className="text-center text-stone-500 text-[0.9375rem] mb-16 max-w-xl mx-auto"
        >
          Nexpura includes free, hands-on migration support. We move your data, train your team, and stay with you through setup.
        </motion.p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
              className="border border-stone-100 rounded-2xl p-8"
            >
              <span className="text-xs tabular-nums text-stone-300 font-medium block mb-4">{step.n}</span>
              <h3 className="font-serif text-xl text-stone-900 mb-3">{step.title}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-stone-500">{step.body}</p>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          className="bg-stone-50 border border-stone-100 rounded-2xl p-8 text-center mb-10"
        >
          <p className="font-serif text-xl text-stone-900">
            Free migration included with every plan.{' '}
            <span className="text-stone-400">No setup fees. No data loss. No downtime.</span>
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.4 }}
          className="text-center"
        >
          <Link
            href="/contact"
            className="inline-flex items-center justify-center min-w-[180px] px-10 py-4 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] relative overflow-hidden transition-shadow duration-400"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
            <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">Book a migration call</span>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
