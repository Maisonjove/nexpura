'use client'

import { useState } from 'react'
import Image from 'next/image'

type Screen = {
  tab: string
  title: string
  description: string
  src: string
  benefit: string
}

const screens: Screen[] = [
  {
    tab: 'Repairs',
    title: 'Repair Tracker',
    description: 'Every repair is logged, assigned, and tracked from intake to collection. Staff have full visibility and customers get live status without the calls.',
    src: '/screenshots/repairs.png',
    benefit: 'No more lost jobs or constant update calls.',
  },
  {
    tab: 'Inventory',
    title: 'Inventory View',
    description: 'Live stock across every piece, stone, and component. No spreadsheets, no guesswork — just an accurate picture of what you have and where it is.',
    src: '/screenshots/inventory.png',
    benefit: 'See what you have, where it is, and what needs action.',
  },
  {
    tab: 'Bespoke',
    title: 'Bespoke Order Timeline',
    description: 'Custom orders run through a structured workflow with milestones, client approvals, and notes in one place — from first consultation to delivery.',
    src: '/screenshots/bespoke.png',
    benefit: 'Keep every commission controlled, visible, and professional.',
  },
  {
    tab: 'Passport',
    title: 'Digital Passport',
    description: 'A QR-verifiable record of materials, craftsmanship, and provenance attached to every eligible piece — giving customers something tangible and trustworthy.',
    src: '/screenshots/passport.png',
    benefit: 'Give every piece a record your clients can trust and verify.',
  },
  {
    tab: 'Analytics',
    title: 'Analytics Dashboard',
    description: 'Sales performance, workshop output, and stock health in one view. Understand what is moving, what is not, and where attention is needed.',
    src: '/screenshots/analytics.png',
    benefit: 'Make decisions from jewellery metrics, not generic reports.',
  },
]

export default function LandingScreenshots() {
  const [active, setActive] = useState(0)

  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        {/* Heading */}
        <h2
          className="nx-fade-in-blur font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-4"
        >
          See Nexpura in action
        </h2>
        <p
          style={{ animationDelay: '0.1s' }}
          className="nx-fade-in text-center text-stone-500 text-[0.9375rem] mb-12 max-w-xl mx-auto"
        >
          A closer look at the screens your team uses every day.
        </p>

        {/* Tab row */}
        <div
          style={{ animationDelay: '0.15s' }}
          className="nx-fade-in-up flex items-center justify-center gap-1 flex-wrap mb-10"
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
        </div>

        {/* Featured screen */}
        <div className="relative">
          <div
            key={active}
            className="nx-fade-in grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-12 items-start"
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
              <p className="text-[0.8125rem] font-medium text-stone-900 border-l-2 border-stone-900 pl-3 mt-4">
                {screens[active].benefit}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
