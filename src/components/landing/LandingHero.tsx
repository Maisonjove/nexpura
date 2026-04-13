'use client'

import { useRef, useCallback } from 'react'
import { motion } from 'framer-motion'

export default function LandingHero() {
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
    <section className="grid grid-cols-1 lg:grid-cols-2 min-h-0 pt-28 pb-16 lg:min-h-screen lg:pt-[72px] lg:pb-0">
      {/* Content */}
      <div className="flex flex-col justify-center px-6 sm:px-10 lg:pl-24 lg:pr-12 text-center lg:text-left pb-12 lg:pb-0">
        <motion.h1
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="font-serif text-4xl sm:text-5xl lg:text-[clamp(2.5rem,4.5vw,4.25rem)] font-normal leading-[1.08] tracking-[-0.01em] text-stone-900 mb-7"
        >
          The Operating System for Modern Jewellers
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
          className="text-base lg:text-lg font-normal leading-relaxed text-stone-500 max-w-[520px] mb-10 mx-auto lg:mx-0"
        >
          Run your sales floor, repairs, custom orders, and stock from one system built for jewellers.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, filter: 'blur(4px)', y: 12 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.65 }}
          className="flex items-center flex-wrap gap-6 self-center lg:self-start"
        >
          <a
            ref={ctaRef}
            href="/contact"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="
              inline-flex items-center justify-center
              min-w-[180px] px-10 py-4 md:min-w-[200px] md:px-12 md:py-[18px]
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
            <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">
              Book a Demo
            </span>
          </a>
          <a
            href="/platform"
            className="text-[0.9375rem] font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900 transition-colors duration-200"
          >
            See the Platform
          </a>
        </motion.div>
      </div>

      {/* Media */}
      <div className="relative w-full mx-auto px-6 lg:px-0 aspect-[4/3] lg:aspect-auto">
        <video
          className="absolute inset-0 w-full h-full object-cover rounded-2xl lg:rounded-none"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src="/video.mp4" type="video/mp4" />
        </video>
      </div>
    </section>
  )
}
