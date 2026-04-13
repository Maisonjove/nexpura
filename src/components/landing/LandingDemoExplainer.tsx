'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'

const steps = [
  { n: '1', title: 'Personalised walkthrough', body: 'We show the modules that matter most to your business.' },
  { n: '2', title: 'Migration discussion', body: 'We review your current tools and outline an import plan.' },
  { n: '3', title: 'Workflow review', body: 'We map your repair, bespoke, and sales workflows to Nexpura.' },
  { n: '4', title: 'Setup recommendations', body: 'You get a recommended configuration before you commit.' },
  { n: '5', title: 'Q&A', body: 'Ask anything. Clear answers, no pressure.' },
]

export default function LandingDemoExplainer() {
  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[700px] mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 mb-4"
        >
          What happens in a demo
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.1 }}
          className="text-stone-500 text-[0.9375rem] mb-14"
        >
          Book 30 minutes and we'll show you exactly how Nexpura fits your business.
        </motion.p>
        <div className="text-left space-y-0 mb-14">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}
              className="flex gap-6 py-6 border-b border-stone-100 last:border-b-0"
            >
              <span className="text-stone-300 font-medium text-sm tabular-nums pt-0.5 shrink-0 w-4">{step.n}</span>
              <div>
                <h3 className="font-serif text-lg text-stone-900 mb-1">{step.title}</h3>
                <p className="text-[0.9375rem] text-stone-500 leading-relaxed">{step.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
        >
          <Link
            href="/contact"
            className="inline-flex items-center justify-center min-w-[180px] px-10 py-4 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] relative overflow-hidden transition-shadow duration-400"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
            <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">Book a Demo</span>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
