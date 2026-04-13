'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'

const screens = [
  {
    tab: 'Repairs',
    title: 'Repair Tracker',
    description: 'Every repair is logged, assigned, and tracked from intake to collection. Staff have full visibility and customers get live status without the calls.',
    src: '/screenshots/repairs.png',
  },
  {
    tab: 'Inventory',
    title: 'Inventory View',
    description: 'Live stock across every piece, stone, and component. No spreadsheets, no guesswork — just an accurate picture of what you have and where it is.',
    src: '/screenshots/inventory.png',
  },
  {
    tab: 'Bespoke Orders',
    title: 'Bespoke Order Timeline',
    description: 'Custom orders run through a structured workflow with milestones, client approvals, and notes in one place — from first consultation to delivery.',
    src: '/screenshots/bespoke.png',
  },
  {
    tab: 'Digital Passport',
    title: 'Digital Passport',
    description: 'A QR-verifiable record of materials, craftsmanship, and provenance attached to every eligible piece — giving customers something tangible and trustworthy.',
    src: '/screenshots/passport.png',
  },
  {
    tab: 'Analytics',
    title: 'Analytics Dashboard',
    description: 'Sales performance, workshop output, and stock health in one view. Understand what is moving, what is not, and where attention is needed.',
    src: '/screenshots/analytics.png',
  },
]

export default function LandingScreenshots() {
  const [active, setActive] = useState(0)

  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        {/* Heading */}
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
          className="text-center text-stone-500 text-[0.9375rem] mb-12 max-w-xl mx-auto"
        >
          A closer look at the screens your team uses every day.
        </motion.p>

        {/* Tab row */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="flex items-center justify-center gap-1 flex-wrap mb-10"
        >
          {screens.map((screen, i) => (
            <button
              key={screen.tab}
              onClick={() => setActive(i)}
              className={`px-5 py-2 rounded-full text-[0.875rem] font-normal transition-all duration-300 cursor-pointer ${
                active === i
                  ? 'bg-stone-900 text-white'
                  : 'text-stone-500 hover:text-stone-900 hover:bg-stone-100'
              }`}
            >
              {screen.tab}
            </button>
          ))}
        </motion.div>

        {/* Featured screen */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-12 items-start"
            >
              {/* Screenshot */}
              <div className="relative rounded-2xl overflow-hidden shadow-[0_4px_40px_rgba(0,0,0,0.1)] bg-stone-200 aspect-video">
                <Image
                  src={screens[active].src}
                  alt={screens[active].title}
                  fill
                  className="object-cover object-top"
                  priority
                />
              </div>

              {/* Description */}
              <div className="flex flex-col justify-center pt-2 lg:pt-6">
                <h3 className="font-serif text-2xl sm:text-3xl text-stone-900 mb-4 leading-[1.2]">
                  {screens[active].title}
                </h3>
                <p className="text-[0.9375rem] leading-relaxed text-stone-500">
                  {screens[active].description}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
