'use client'

import { useRef, useCallback } from 'react'
import Link from 'next/link'

const bulletPoints = [
  'Live stock updates',
  'Reservation and hold tracking',
  'Provenance and cost history',
  'Visibility across multiple locations',
]

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
          <h2
            className="nx-fade-in-blur font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 mb-6"
          >
            Inventory Intelligence
          </h2>
          <p
            style={{ animationDelay: '0.1s' }}
            className="nx-fade-in-blur text-base lg:text-[1.0625rem] leading-relaxed text-stone-500 max-w-[480px] mx-auto md:mx-0 mb-6"
          >
            Track every piece, stone, metal, and component with live stock status, reservation tracking, location visibility, and full item history.
          </p>
          <ul className="space-y-3 mb-8 text-left max-w-[480px] mx-auto md:mx-0">
            {bulletPoints.map((point, i) => (
              <li
                key={point}
                style={{ animationDelay: `${0.15 + i * 0.07}s` }}
                className="nx-fade-in flex items-start gap-3 text-[0.9375rem] text-stone-600 leading-relaxed"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                {point}
              </li>
            ))}
          </ul>
          <div
            style={{ animationDelay: '0.35s' }}
            className="nx-fade-in-blur-up"
          >
            <Link
              ref={ctaRef}
              href="/features#inventory"
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
                See inventory workflows
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
