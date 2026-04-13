'use client'
import { motion } from 'framer-motion'

export default function LandingTestimonialsExpanded() {
  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        <motion.h2
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-16"
        >
          What jewellers say
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="border border-stone-100 rounded-2xl p-12 text-center max-w-[700px] mx-auto"
        >
          <p className="font-serif text-xl text-stone-600 leading-relaxed mb-6">
            We are working with our clients to document their experience.
          </p>
          <p className="text-[0.9375rem] text-stone-400">
            Client stories coming soon.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
