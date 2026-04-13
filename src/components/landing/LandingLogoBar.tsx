'use client'

import { motion } from 'framer-motion'

export default function LandingLogoBar() {
  return (
    <section className="bg-white py-16">
      <motion.p
        initial={{ opacity: 0, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, filter: 'blur(0px)' }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="text-[0.8125rem] font-normal text-stone-400 tracking-wide text-center leading-relaxed px-6"
      >
        Built for jewellers&nbsp;&nbsp;·&nbsp;&nbsp;Free guided migration&nbsp;&nbsp;·&nbsp;&nbsp;No hidden fees&nbsp;&nbsp;·&nbsp;&nbsp;14-day trial
      </motion.p>
    </section>
  )
}
