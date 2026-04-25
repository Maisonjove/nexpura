'use client'

import { useEffect, useRef, useState } from 'react'
import Button from './ui/Button'
import SectionHeader from './ui/SectionHeader'

/**
 * Migration timeline per Kaitlyn's brief (section 11). Five-step
 * horizontal timeline desktop / vertical stack mobile, with a
 * connecting line that fills champagne left-to-right (or top-to-bottom)
 * as the section scrolls into view. Each step circle activates
 * (charcoal fill, white number) when the line passes it.
 *
 * CTAs at the bottom: Start Free Trial primary, Talk to Migration
 * Support secondary, with the brief's microcopy.
 */

const STEPS = [
  {
    title: 'Audit your current setup',
    body: 'We assess your tools, workflows, data, and what needs to come across.',
  },
  {
    title: 'Prepare your data',
    body: 'Customer records, stock, repair history, supplier records, and key business data are cleaned and structured.',
  },
  {
    title: 'Import and configure',
    body: 'Your core workflows are mapped into Nexpura so your team can work the way your business actually operates.',
  },
  {
    title: 'Train your team',
    body: 'Guided onboarding helps your staff understand the platform quickly.',
  },
  {
    title: 'Go live with support',
    body: 'Your team launches with practical support so the transition feels controlled.',
  },
] as const

export default function LandingMigration() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0) // 0–1, drives the line fill

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1)
      return
    }
    const el = sectionRef.current
    if (!el) return

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (e.isIntersecting) {
          // Animate fill 0 → 1 over 1.2s once on first scroll-in.
          const start = performance.now()
          const duration = 1200
          let raf = 0
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration)
            // ease-out
            setProgress(1 - Math.pow(1 - t, 3))
            if (t < 1) raf = requestAnimationFrame(tick)
          }
          raf = requestAnimationFrame(tick)
          io.disconnect()
          return () => cancelAnimationFrame(raf)
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Each step "activates" when progress passes a threshold. With 5
  // evenly spaced steps + the line travelling between them, step i is
  // active when progress >= i / (n - 1).
  const isActive = (i: number) => progress >= i / (STEPS.length - 1) - 0.001

  return (
    <section id="migration" className="bg-m-ivory py-24 lg:py-32 px-6 sm:px-12">
      <div className="max-w-[1200px] mx-auto" ref={sectionRef}>
        <SectionHeader
          title="Switch without the stress"
          subtitle="We guide your move from your current setup to Nexpura with migration, onboarding, and practical support from day one."
        />

        {/* Desktop: horizontal 5-step timeline */}
        <div className="hidden lg:block relative mt-20">
          {/* Track */}
          <div className="absolute top-4 left-[5%] right-[5%] h-px bg-m-border-soft" />
          {/* Filled portion (champagne) */}
          <div
            className="absolute top-4 left-[5%] h-px bg-m-champagne origin-left"
            style={{ width: `calc(90% * ${progress})`, transition: 'width 60ms linear' }}
          />

          <ol className="relative grid grid-cols-5 gap-6 z-10">
            {STEPS.map((step, i) => (
              <li key={step.title} className="text-center px-2">
                <div
                  className={`mx-auto w-8 h-8 rounded-full border flex items-center justify-center text-[13px] font-medium transition-colors duration-200 [transition-timing-function:var(--m-ease)] ${
                    isActive(i)
                      ? 'bg-m-charcoal border-m-charcoal text-white'
                      : 'bg-m-ivory border-m-border-soft text-m-text-muted'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="mt-5 font-sans font-semibold text-[16px] text-m-charcoal leading-[1.3]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-[1.5] text-m-text-secondary">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>

        {/* Mobile: vertical timeline */}
        <ol className="lg:hidden relative mt-12 pl-10">
          <div className="absolute top-2 bottom-2 left-4 w-px bg-m-border-soft" />
          <div
            className="absolute top-2 left-4 w-px bg-m-champagne"
            style={{ height: `calc((100% - 16px) * ${progress})`, transition: 'height 60ms linear' }}
          />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative pb-8 last:pb-0">
              <div
                className={`absolute -left-[26px] top-0 w-8 h-8 rounded-full border flex items-center justify-center text-[13px] font-medium transition-colors duration-200 ${
                  isActive(i)
                    ? 'bg-m-charcoal border-m-charcoal text-white'
                    : 'bg-m-ivory border-m-border-soft text-m-text-muted'
                }`}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 className="font-sans font-semibold text-[16px] text-m-charcoal leading-[1.3] pt-1">
                {step.title}
              </h3>
              <p className="mt-2 text-[14px] leading-[1.5] text-m-text-secondary">{step.body}</p>
            </li>
          ))}
        </ol>

        {/* CTAs */}
        <div className="mt-16 flex flex-col items-center gap-3 m-reveal">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button href="/signup" size="lg">
              Start Free Trial
            </Button>
            <Button href="/contact" variant="secondary" size="lg">
              Talk to Migration Support
            </Button>
          </div>
          <p className="text-[13px] tracking-[0.05em] text-m-text-muted">
            Guided migration available for eligible businesses.
          </p>
        </div>
      </div>
    </section>
  )
}
