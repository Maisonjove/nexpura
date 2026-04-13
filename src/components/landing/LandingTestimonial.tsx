'use client'

import { motion } from 'framer-motion'

export default function LandingTestimonial() {
  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[900px] mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-xl sm:text-2xl lg:text-3xl font-normal leading-[1.3] tracking-[-0.01em] text-stone-600 mb-8"
        >
          Built by people who understand the jewellery trade.
        </motion.div>

        <motion.p
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="text-[0.9375rem] text-stone-400"
        >
          Client stories coming soon.
        </motion.p>
      </div>
    </section>
  )
}
