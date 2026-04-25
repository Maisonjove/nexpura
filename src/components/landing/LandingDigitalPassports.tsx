'use client'

import { useState } from 'react'
import Image from 'next/image'

/**
 * Digital Passport trust section per Kaitlyn's brief (section 13).
 *
 * Hover interaction: each bullet hovers a champagne-coloured highlight
 * over the corresponding region of the passport screenshot. Coordinates
 * (top/left/width/height as % of the image container) are mapped per
 * bullet so the overlay points at the relevant block.
 */

interface Bullet {
  label: string
  /** Position of the highlight overlay over the passport screenshot (% based). */
  highlight: { top: string; left: string; width: string; height: string }
}

const BULLETS: readonly Bullet[] = [
  // QR code area — typically top-right of a passport-style screen
  {
    label: 'Instant customer verification',
    highlight: { top: '6%', left: '60%', width: '32%', height: '20%' },
  },
  // Specifications / provenance block — middle-left
  {
    label: 'Piece-level provenance history',
    highlight: { top: '28%', left: '4%', width: '52%', height: '28%' },
  },
  // Financial summary block — typically lower-right
  {
    label: 'Better trust at point of sale',
    highlight: { top: '58%', left: '52%', width: '40%', height: '20%' },
  },
  // Stage timeline / history block — bottom strip
  {
    label: 'Stronger resale and aftercare confidence',
    highlight: { top: '78%', left: '4%', width: '92%', height: '18%' },
  },
] as const

export default function LandingDigitalPassports() {
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <section className="bg-m-ivory py-24 lg:py-32 px-6 sm:px-12">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Copy */}
        <div>
          <h2 className="font-serif text-[34px] sm:text-[40px] leading-[1.15] text-m-charcoal">
            Authenticity, provenance, and trust — attached to every piece
          </h2>
          <p className="mt-6 text-[16px] sm:text-[17px] leading-[1.6] text-m-text-secondary">
            When a customer buys from you, they should know exactly what they own.
          </p>
          <p className="mt-3 text-[16px] sm:text-[17px] leading-[1.6] text-m-text-secondary">
            Nexpura generates a digital passport for every eligible piece, linked by QR code to a verified record of materials, craftsmanship, and provenance.
          </p>
          <ul className="mt-8 space-y-1">
            {BULLETS.map((b, i) => (
              <li
                key={b.label}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
                className={`group flex items-start gap-3 px-3 py-3 rounded-lg cursor-default transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne ${
                  hovered === i ? 'bg-m-champagne-soft/40' : ''
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200 ${
                    hovered === i ? 'bg-m-champagne' : 'bg-m-text-muted'
                  }`}
                />
                <span className="text-[15px] leading-[1.5] text-m-charcoal">{b.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Screenshot + hover highlight overlay */}
        <div className="relative rounded-2xl overflow-hidden border border-m-border-soft shadow-[0_8px_32px_rgba(0,0,0,0.08)] bg-white">
          <Image
            src="/screenshots/passport.png"
            alt="Nexpura Digital Passport — provenance, materials, and history"
            width={1000}
            height={1200}
            className="w-full h-auto"
          />
          {BULLETS.map((b, i) => (
            <div
              key={b.label}
              aria-hidden
              className="absolute pointer-events-none rounded-lg border-2 transition-opacity duration-200 [transition-timing-function:var(--m-ease)]"
              style={{
                top: b.highlight.top,
                left: b.highlight.left,
                width: b.highlight.width,
                height: b.highlight.height,
                opacity: hovered === i ? 1 : 0,
                background: 'rgba(201,169,97,0.12)',
                borderColor: 'rgba(201,169,97,0.7)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.0)',
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
