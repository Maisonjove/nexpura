'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

const items = [
  {
    title: 'Digital Passports',
    description:
      'Every piece leaves your atelier with a verifiable certificate of authenticity. One QR scan and your client sees provenance, materials, craftsmanship. All confirmed.',
  },
  {
    title: 'Bespoke, from sketch to hand',
    description:
      'Twelve stages. Stone sourcing, CAD review, client approval, setting, polish. Every commission tracked with the same precision you put into the piece itself.',
  },
  {
    title: 'Memo & Consignment',
    description:
      'Pieces on trial with a client. Stones on consignment from Antwerp. Due-back dates, commission splits, full audit trail. The way the trade actually works.',
  },
  {
    title: 'A copilot that knows your business',
    description:
      'Ask in plain English. "What sold best this quarter?" "Which repairs are overdue?" Your data answers back. No spreadsheets, no waiting.',
  },
]

function DiffItem({ item, index, total }: { item: typeof items[0]; index: number; total: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.75', 'start 0.35'],
  })

  const opacity = useTransform(scrollYProgress, [0, 1], [0.25, 1])
  const y = useTransform(scrollYProgress, [0, 1], [8, 0])

  return (
    <motion.div
      ref={ref}
      style={{ opacity, y }}
      className="py-10 border-b border-stone-200 first:pt-0 last:border-b-0"
    >
      <div className="flex items-baseline gap-4 mb-3">
        <span className="text-sm tabular-nums text-stone-300 font-medium">
          0{index + 1}
        </span>
        <h3 className="font-serif text-xl lg:text-2xl text-stone-900">
          {item.title}
        </h3>
      </div>
      <p className="text-stone-500 text-[0.9375rem] leading-relaxed pl-10">
        {item.description}
      </p>
    </motion.div>
  )
}

export default function LandingDifferentiators() {
  return (
    <section className="py-20 lg:py-36 px-6 sm:px-10 lg:px-20 bg-white">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left - sticky title */}
          <div className="lg:sticky lg:top-32 lg:self-start lg:h-[calc(100vh-10rem)] lg:flex lg:flex-col lg:justify-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-[3.25rem] font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 mb-6">
                The things your
                <br />
                current software
                <br />
                simply can&apos;t do.
              </h2>
              <p className="text-stone-400 text-base leading-relaxed max-w-[400px]">
                Built from the ground up for jewellers. Not bolted onto generic retail.
              </p>
            </motion.div>
          </div>

          {/* Right - scroll-revealed items */}
          <div>
            {items.map((item, index) => (
              <DiffItem key={item.title} item={item} index={index} total={items.length} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
