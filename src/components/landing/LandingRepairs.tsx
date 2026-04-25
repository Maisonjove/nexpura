'use client'

import { useState } from 'react'
import Image from 'next/image'

/**
 * Interactive repair workflow stepper per Kaitlyn's correction Fix #3.
 *
 * Differences from the prior version:
 *  - Number circle bumped to 42px, gap to text bumped to 20px (was 8px),
 *    description sits below title in a flex column (was wedged under
 *    the circle).
 *  - Step copy expanded to the brief's exact strings (was truncated).
 *  - Floating "Step N" callout overlay on the screenshot REMOVED — it
 *    pretended to point at specific UI regions that didn't exist.
 *  - Replaced with a static detail panel below the screenshot that
 *    surfaces the active step's title + body verbatim from `STEPS`.
 *  - Auto-advance disabled. Step state changes only on click.
 *  - Step click does NOT navigate, scroll, or open a tab — only
 *    setActive. Footer "See repair workflow →" removed (Fix #7 — no
 *    verified per-segment workflow page exists).
 */

interface Step {
  title: string
  body: string
}

const STEPS: readonly Step[] = [
  {
    title: 'Log repair intake',
    body:
      'Capture the customer, item, issue, images, quoted price, and expected completion date.',
  },
  {
    title: 'Add item details',
    body:
      'Record photos, pricing, due date, and item specifications in one structured intake.',
  },
  {
    title: 'Assign to staff',
    body:
      'Route the job to the right team member with a clear deadline and priority.',
  },
  {
    title: 'Track repair status',
    body:
      'Move jobs through clear stages so your team always knows what is pending, in progress, delayed, or ready.',
  },
  {
    title: 'Notify the customer',
    body: 'Share status updates without constant phone calls or manual follow-ups.',
  },
  {
    title: 'Mark ready for collection',
    body: 'Trigger automatic customer notifications when the job is complete.',
  },
  {
    title: 'Close and record',
    body:
      'Save the full job history to the customer record so repairs, customer activity, and aftercare stay connected.',
  },
] as const

export default function LandingRepairs() {
  const [active, setActive] = useState(0)
  const handleStepClick = (i: number) => setActive(i)

  return (
    <section className="bg-m-ivory py-24 lg:py-32 px-6 sm:px-12">
      <div className="max-w-[1200px] mx-auto">
        <div className="max-w-3xl">
          <h2 className="font-serif text-[34px] sm:text-[40px] leading-[1.15] text-m-charcoal">
            The repair workflow your customers can actually follow
          </h2>
          <p className="mt-6 text-[16px] sm:text-[17px] leading-[1.6] text-m-text-secondary">
            Every repair is logged, assigned, tracked, and updated in one place, from intake to collection.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,460px)_1fr] gap-10 lg:gap-16 items-start mt-14">
          {/* Left — interactive stepper */}
          <ol className="relative">
            {/* Vertical connector line behind the number circles */}
            <div className="absolute left-[21px] top-6 bottom-6 w-px bg-[#E8E1D6]" />
            {STEPS.map((step, i) => {
              const isActive = i === active
              return (
                <li key={step.title} className="relative">
                  <button
                    type="button"
                    onClick={() => handleStepClick(i)}
                    aria-pressed={isActive}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={`Step ${i + 1}: ${step.title}`}
                    className="relative z-[1] flex items-start gap-5 w-full py-3.5 text-left bg-transparent border-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne rounded-md"
                  >
                    {/* 42px number circle */}
                    <span
                      aria-hidden
                      className={`shrink-0 w-[42px] h-[42px] rounded-full border inline-flex items-center justify-center text-[16px] font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-m-charcoal border-m-charcoal text-white'
                          : 'bg-[#FAF7F2] border-[#E3DED5] text-[#777]'
                      }`}
                    >
                      {i + 1}
                    </span>
                    {/* Title + (active-only) description, in a flex column
                        so the description never wedges under the circle. */}
                    <span className="flex flex-col flex-1 min-w-0 pt-[6px]">
                      <span
                        className={`font-sans font-semibold text-[20px] lg:text-[22px] leading-[1.3] transition-colors ${
                          isActive ? 'text-m-charcoal' : 'text-[#5C5C5C]'
                        }`}
                      >
                        {step.title}
                      </span>
                      {isActive && (
                        <span className="mt-2.5 text-[16px] leading-[1.55] text-[#666] max-w-[500px] motion-safe:animate-[stepDescFadeIn_250ms_var(--m-ease)]">
                          {step.body}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          {/* Right — screenshot + active-step detail panel */}
          <div className="flex flex-col gap-6">
            <div className="relative rounded-2xl overflow-hidden border border-m-border-soft shadow-[0_8px_24px_rgba(0,0,0,0.06)] bg-white">
              <Image
                src="/screenshots/repairs.png"
                alt="Nexpura Repair Tracker — repair pipeline with stage transitions"
                width={1200}
                height={750}
                className="w-full h-auto"
                priority
              />
            </div>
            <aside
              aria-live="polite"
              className="bg-white border border-m-border-soft rounded-[18px] px-6 py-[22px] shadow-[0_12px_30px_rgba(0,0,0,0.06)] max-w-[520px]"
            >
              <span className="block text-[11px] tracking-[0.08em] uppercase text-[#9A8F82] font-medium mb-2.5">
                Active workflow step
              </span>
              <h4 className="font-serif text-[22px] font-medium text-m-charcoal m-0 leading-[1.25] mb-2">
                {STEPS[active].title}
              </h4>
              <p className="text-[15px] leading-[1.6] text-[#5C5C5C] m-0">
                {STEPS[active].body}
              </p>
            </aside>
          </div>
        </div>
      </div>
    </section>
  )
}
