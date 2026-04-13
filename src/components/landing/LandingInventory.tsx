'use client'

import { useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

export default function LandingInventory() {
  const ctaRef = useRef<HTMLAnchorElement>(null)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const el = ctaRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      el.style.transform = `translate(${x * 0.08}px, ${y * 0.15}px)`
    },
    []
  )

  const handleMouseLeave = useCallback(() => {
    const el = ctaRef.current
    if (!el) return
    el.style.transition = 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)'
    el.style.transform = ''
    const onEnd = () => {
      el.style.transition = ''
      el.removeEventListener('transitionend', onEnd)
    }
    el.addEventListener('transitionend', onEnd)
  }, [])

  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-24 items-center max-w-[1200px] mx-auto">
        {/* Image */}
        <div className="relative aspect-[5/4] rounded-2xl overflow-hidden">
          <img
            src="/features/inventory1.png"
            alt="Inventory Intelligence"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="text-center md:text-left">
          <motion.h2
            initial={{ opacity: 0, filter: 'blur(6px)' }}
            whileInView={{ opacity: 1, filter: 'blur(0px)' }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 mb-6"
          >
            Inventory Intelligence
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, filter: 'blur(6px)' }}
            whileInView={{ opacity: 1, filter: 'blur(0px)' }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="text-base lg:text-[1.0625rem] leading-relaxed text-stone-500 max-w-[480px] mx-auto md:mx-0 mb-8"
          >
            Live tracking for every piece. Effortlessly manage your
            jewellery assets with precision serial ID, instant stock status
            updates, and reservation tracking from any device. Eliminate
            discrepancies and gain complete visibility into your collection.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, filter: 'blur(4px)', y: 16 }}
            whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
          >
            <a
              ref={ctaRef}
              href="/signup"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className="
                inline-flex items-center justify-center
                min-w-[180px] px-10 py-4
                bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]
                rounded-full
                shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]
                transition-shadow duration-400
                hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]
                active:shadow-[0_1px_2px_rgba(0,0,0,0.25),0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]
                relative overflow-hidden cursor-pointer
              "
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
              <span className="text-[0.9375rem] font-medium text-white tracking-[0.01em] relative z-10">
                Learn More
              </span>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
