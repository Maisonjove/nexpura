'use client'
import { motion } from 'framer-motion'
import Image from 'next/image'

const screens = [
  { label: 'Dashboard Overview', src: '/screenshots/dashboard.png' },
  { label: 'Repair Tracker', src: '/screenshots/repairs.png' },
  { label: 'Inventory View', src: '/screenshots/inventory.png' },
  { label: 'Bespoke Order Timeline', src: '/screenshots/bespoke.png' },
  { label: 'Digital Passport', src: '/screenshots/passport.png' },
  { label: 'Analytics Dashboard', src: '/screenshots/analytics.png' },
]

export default function LandingScreenshots() {
  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        <motion.h2
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-4"
        >
          See Nexpura in action
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.1 }}
          className="text-center text-stone-500 text-[0.9375rem] mb-16 max-w-xl mx-auto"
        >
          Every tool a modern jeweller needs — beautifully integrated.
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {screens.map((screen, i) => (
            <motion.div
              key={screen.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: i * 0.07 }}
              className="group relative bg-stone-100 rounded-2xl overflow-hidden"
            >
              <div className="aspect-video relative">
                <Image
                  src={screen.src}
                  alt={screen.label}
                  fill
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-white text-sm font-medium">{screen.label}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
