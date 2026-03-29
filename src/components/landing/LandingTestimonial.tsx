'use client'

import { motion } from 'framer-motion'

export default function LandingTestimonial() {
  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[900px] mx-auto text-center">
        <motion.blockquote
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-xl sm:text-3xl lg:text-[2.75rem] font-normal leading-[1.3] tracking-[-0.01em] text-stone-900 mb-12"
        >
          &ldquo;Nexpura has revolutionized our atelier. The precision and
          elegance of the platform perfectly complement the bespoke jewellery we
          create. It&rsquo;s an indispensable tool for modern
          craftsmanship.&rdquo;
        </motion.blockquote>

        <motion.div
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
          className="flex flex-col items-center gap-3"
        >
          <img
            src="/features/signature.png"
            alt="Signature"
            className="h-20 w-auto opacity-70"
          />
          <div>
            <p className="text-[0.9375rem] font-semibold text-stone-900">
              Elise Dubois
            </p>
            <p className="text-[0.875rem] text-stone-500">
              Master Jeweller &amp; Founder, Maison Dubois
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
