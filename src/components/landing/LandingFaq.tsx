'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const faqs = [
  {
    q: 'How long does migration take?',
    a: 'Timelines vary depending on your setup, data quality, and business complexity. We guide the process from review to go-live and keep you informed throughout.',
  },
  {
    q: 'Is migration included?',
    a: 'Yes. Guided migration is included with every plan, with careful data handling and minimal disruption during setup.',
  },
  {
    q: 'Can Nexpura replace my current POS?',
    a: 'Yes. Nexpura is designed to replace disconnected retail and operational tools with one connected platform built specifically for jewellers.',
  },
  {
    q: 'Does it support repair job tracking?',
    a: 'Yes. Every repair can be logged, assigned, tracked, and updated in one workflow, with status visibility for both staff and customers.',
  },
  {
    q: 'Can I track bespoke orders?',
    a: 'Yes. Nexpura includes a structured bespoke workflow with approvals, milestones, notes, sourcing, and deposits from consultation through to delivery.',
  },
]

export default function LandingFaq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[720px] mx-auto">
        <motion.h2
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-16"
        >
          Questions About Switching to Nexpura
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          {faqs.map((faq, i) => (
            <div key={faq.q} className="border-t border-stone-200 last:border-b last:border-stone-200">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-6 py-7 text-left cursor-pointer group"
              >
                <span className="font-serif text-lg sm:text-xl text-stone-900 leading-snug">
                  {faq.q}
                </span>
                <span
                  className={`shrink-0 w-5 h-5 flex items-center justify-center text-stone-400 transition-transform duration-300 ${
                    open === i ? 'rotate-45' : ''
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </span>
              </button>

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    key="answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="text-[0.9375rem] leading-relaxed text-stone-500 pb-7">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
