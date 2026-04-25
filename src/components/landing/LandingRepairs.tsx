'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

/**
 * Interactive repair workflow stepper per Kaitlyn's brief (section 9).
 *
 * Left column: clickable vertical stepper with 7 steps. Active step
 * shows the description (smooth height-expand). Inactive steps show
 * just number + title.
 *
 * Right column: existing screenshot + a champagne-bordered callout
 * that fades/slides in as the active step changes — pointing to a
 * different region of the screenshot per step.
 *
 * Auto-progression: when the section first scrolls into view, advance
 * once through every step at 2.5s intervals. Stops auto-advance the
 * moment the user clicks any step manually.
 */

interface Step {
  title: string
  body: string
  /** Position of the callout overlay over the screenshot (% from top-left). */
  callout: { top: string; left: string }
}

const STEPS: readonly Step[] = [
  {
    title: 'Log repair intake',
    body:
      'Capture the customer, item, issue, images, quoted price, and expected completion date.',
    callout: { top: '10%', left: '50%' },
  },
  {
    title: 'Add item details',
    body: 'Photos, pricing, due date, and item specifications.',
    callout: { top: '24%', left: '40%' },
  },
  {
    title: 'Assign to staff',
    body: 'Route to the right team member with deadline and priority.',
    callout: { top: '36%', left: '64%' },
  },
  {
    title: 'Track repair status',
    body:
      'Move jobs through clear stages: pending, in progress, delayed, ready.',
    callout: { top: '48%', left: '36%' },
  },
  {
    title: 'Notify the customer',
    body: 'Share status updates without constant phone calls.',
    callout: { top: '60%', left: '60%' },
  },
  {
    title: 'Mark ready for collection',
    body: 'Trigger automatic customer notification.',
    callout: { top: '72%', left: '44%' },
  },
  {
    title: 'Close and record',
    body: 'Save the full job history to the customer record.',
    callout: { top: '84%', left: '56%' },
  },
] as const

export default function LandingRepairs() {
  const [active, setActive] = useState(0)
  const [autoStopped, setAutoStopped] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  // Auto-advance once on scroll-in.
  useEffect(() => {
    if (typeof window === 'undefined' || autoStopped) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const el = sectionRef.current
    if (!el) return

    let started = false
    let timer: ReturnType<typeof setInterval> | null = null

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (e.isIntersecting && !started) {
          started = true
          timer = setInterval(() => {
            setActive((prev) => {
              const next = prev + 1
              if (next >= STEPS.length) {
                if (timer) clearInterval(timer)
                return STEPS.length - 1
              }
              return next
            })
          }, 2500)
          io.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      if (timer) clearInterval(timer)
    }
  }, [autoStopped])

  const handleStepClick = (i: number) => {
    setActive(i)
    setAutoStopped(true)
  }

  return (
    <section ref={sectionRef} className="bg-m-ivory py-24 lg:py-32 px-6 sm:px-12">
      <div className="max-w-[1200px] mx-auto">
        <div className="max-w-3xl">
          <h2 className="font-serif text-[34px] sm:text-[40px] leading-[1.15] text-m-charcoal">
            The repair workflow your customers can actually follow
          </h2>
          <p className="mt-6 text-[16px] sm:text-[17px] leading-[1.6] text-m-text-secondary">
            Every repair is logged, assigned, tracked, and updated in one place, from intake to collection.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,440px)_1fr] gap-10 lg:gap-16 items-start mt-14">
          {/* Left — interactive stepper */}
          <ol className="relative pl-10">
            {/* Vertical track */}
            <div className="absolute left-[14px] top-2 bottom-2 w-px bg-m-border-soft" />
            {STEPS.map((step, i) => {
              const isActive = i === active
              return (
                <li key={step.title} className="relative pb-3 last:pb-0">
                  <button
                    type="button"
                    onClick={() => handleStepClick(i)}
                    aria-pressed={isActive}
                    aria-label={`Step ${i + 1}: ${step.title}`}
                    className="text-left w-full py-3 pr-2 group rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne"
                  >
                    {/* Step number circle */}
                    <span
                      aria-hidden
                      className={`absolute -left-[26px] top-2 w-7 h-7 rounded-full border flex items-center justify-center text-[12px] font-medium transition-colors duration-200 ${
                        isActive
                          ? 'bg-m-charcoal border-m-charcoal text-white'
                          : 'bg-m-ivory border-m-border-soft text-m-text-muted group-hover:border-m-charcoal/40'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`block font-sans font-semibold text-[16px] leading-[1.3] transition-colors ${
                        isActive ? 'text-m-charcoal' : 'text-m-text-secondary group-hover:text-m-charcoal'
                      }`}
                    >
                      {step.title}
                    </span>
                    {/* Description — only visible on the active step. Smooth height expand. */}
                    <div
                      className="grid overflow-hidden transition-[grid-template-rows,opacity] duration-[250ms] [transition-timing-function:var(--m-ease)]"
                      style={{
                        gridTemplateRows: isActive ? '1fr' : '0fr',
                        opacity: isActive ? 1 : 0,
                      }}
                    >
                      <span className="min-h-0 block pr-2">
                        <span className="block mt-2 text-[14px] leading-[1.5] text-m-text-secondary">
                          {step.body}
                        </span>
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>

          {/* Right — screenshot + dynamic callout */}
          <div className="relative rounded-2xl overflow-hidden border border-m-border-soft shadow-[0_8px_24px_rgba(0,0,0,0.06)] bg-white">
            <Image
              src="/screenshots/repairs.png"
              alt="Nexpura Repair Tracker — repair pipeline with stage transitions"
              width={1200}
              height={750}
              className="w-full h-auto"
              priority
            />
            {/* Callout — re-positions per active step. */}
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                top: STEPS[active].callout.top,
                left: STEPS[active].callout.left,
                transition: 'top 250ms var(--m-ease), left 250ms var(--m-ease)',
              }}
            >
              <div className="-translate-x-1/2 -translate-y-1/2 bg-white border border-m-champagne rounded-lg px-3 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                <span className="text-[12px] font-medium text-m-charcoal">
                  Step {active + 1}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer link only — no primary CTA per the brief */}
        <div className="mt-12 lg:mt-16 text-center lg:text-left">
          <Link
            href="/features#repairs"
            className="inline-flex items-center gap-1.5 text-[14px] font-sans font-medium text-m-charcoal hover:underline underline-offset-4 decoration-m-charcoal"
          >
            See repair workflow
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
