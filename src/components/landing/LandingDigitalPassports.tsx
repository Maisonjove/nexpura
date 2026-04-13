'use client'
import { motion } from 'framer-motion'
import Image from 'next/image'

const benefits = [
  'Authenticity customers can verify instantly',
  'Provenance records that follow the piece',
  'Resale confidence — buyers trust what they can check',
  'Luxury-grade transparency without luxury-grade overhead',
]

export default function LandingDigitalPassports() {
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
            Every piece, provenance-verified.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.1 }}
            className="text-stone-500 text-[0.9375rem] leading-relaxed mb-4"
          >
            When a customer buys from you, they deserve to know exactly what they own.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.15 }}
            className="text-stone-500 text-[0.9375rem] leading-relaxed mb-8"
          >
            Nexpura generates a digital passport for every piece — linked via QR code to a verified record of materials, craftsmanship, and provenance.
          </motion.p>
          <ul className="space-y-3">
            {benefits.map((b, i) => (
              <motion.li
                key={b}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 + i * 0.07 }}
                className="flex items-start gap-3 text-[0.9375rem] text-stone-600 leading-relaxed"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                {b}
              </motion.li>
            ))}
          </ul>
        </div>
        <motion.div
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.2 }}
          className="relative rounded-2xl overflow-hidden shadow-xl"
        >
          <Image
            src="/screenshots/passport.png"
            alt="Nexpura Digital Passport - Item Specifications"
            width={800}
            height={600}
            className="w-full h-auto"
          />
        </motion.div>
      </div>
    </section>
  )
}
