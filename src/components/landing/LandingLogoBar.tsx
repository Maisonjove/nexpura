'use client'

import { motion } from 'framer-motion'

const logos = [
  { name: 'Cartier', tracking: '0.18em' },
  { name: 'BVLGARI', tracking: '0.22em' },
  { name: 'Van Cleef & Arpels', tracking: '0.08em' },
  { name: 'TIFFANY & CO.', tracking: '0.16em' },
  { name: 'CHOPARD', tracking: '0.2em' },
  { name: 'Harry Winston', tracking: '0.06em' },
]

export default function LandingLogoBar() {
  return (
    <section className="bg-white py-16">
      <motion.p
        initial={{ opacity: 0, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, filter: 'blur(0px)' }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="text-center text-[0.8125rem] font-normal tracking-[0.15em] uppercase text-stone-400 mb-10"
      >
        Trusted by the houses that shape fine jewellery
      </motion.p>
      <motion.div
        initial={{ opacity: 0, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, filter: 'blur(0px)' }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="flex items-center justify-center gap-x-8 sm:gap-x-12 lg:gap-x-16 gap-y-5 flex-wrap px-6 sm:px-10 lg:px-20 max-w-[1200px] mx-auto"
      >
        {logos.map((logo) => (
          <span
            key={logo.name}
            className="font-serif text-sm lg:text-lg text-stone-900 select-none whitespace-nowrap transition-opacity duration-500 ease-out hover:opacity-40 cursor-default"
            style={{ letterSpacing: logo.tracking }}
          >
            {logo.name}
          </span>
        ))}
      </motion.div>
    </section>
  )
}
