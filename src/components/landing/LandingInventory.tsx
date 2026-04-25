'use client'

import Image from 'next/image'

/**
 * Inventory Intelligence per Kaitlyn's brief (section 14).
 *
 * Keeps the existing tray imagery and overlays UI-style status badges
 * on top — each badge has a status-coloured dot, soft charcoal
 * background at 88% opacity, and a hover tooltip that explains what
 * the status means. Badges gently pulse (1 cycle / 4s, 2% scale)
 * unless prefers-reduced-motion is set.
 *
 * CTA stays secondary outlined (not promoted to primary per the brief).
 */

interface BadgeSpec {
  status: 'In Stock' | 'Reserved' | 'Low Stock' | 'On Memo' | 'Sold'
  dot: string
  tooltip: string
  /** Position over the inventory image (% based). */
  pos: { top: string; left: string }
}

const BADGES: readonly BadgeSpec[] = [
  {
    status: 'In Stock',
    dot: '#10B981',
    tooltip: 'Available for sale across all locations',
    pos: { top: '18%', left: '12%' },
  },
  {
    status: 'Reserved',
    dot: '#F59E0B',
    tooltip: 'Reserved by customer until Friday',
    pos: { top: '38%', left: '60%' },
  },
  {
    status: 'Low Stock',
    dot: '#EF4444',
    tooltip: 'Low stock: only 1 available',
    pos: { top: '62%', left: '24%' },
  },
  {
    status: 'On Memo',
    dot: '#3B82F6',
    tooltip: 'On memo with consignment partner',
    pos: { top: '14%', left: '64%' },
  },
] as const

const BULLETS = [
  'Live stock updates',
  'Reservation and hold tracking',
  'Provenance and cost history',
  'Visibility across multiple locations',
] as const

export default function LandingInventory() {
  return (
    <section className="bg-white py-24 lg:py-32 px-6 sm:px-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center max-w-[1200px] mx-auto">
        {/* Image with overlay badges */}
        <div className="relative aspect-[5/4] rounded-2xl overflow-hidden border border-m-border-soft shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
          <Image
            src="/features/inventory1.png"
            alt="Jewellery inventory tray with status badges"
            fill
            sizes="(min-width: 1024px) 560px, 100vw"
            className="object-cover"
          />
          {BADGES.map((b) => (
            <StatusBadge key={b.status} {...b} />
          ))}
        </div>

        {/* Copy */}
        <div>
          <h2 className="font-serif text-[34px] sm:text-[40px] leading-[1.15] text-m-charcoal">
            Inventory Intelligence
          </h2>
          <p className="mt-6 text-[16px] sm:text-[17px] leading-[1.6] text-m-text-secondary max-w-[520px]">
            Track every piece, stone, metal, and component with live stock status, reservation tracking, location visibility, and full item history.
          </p>
          <ul className="mt-8 space-y-3 max-w-[520px]">
            {BULLETS.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-[15px] leading-[1.6] text-m-text-secondary"
              >
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-m-champagne shrink-0" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
          {/* "See inventory workflows" button removed per Kaitlyn's
              correction Fix #6 — no verified marketing-tree inventory
              page exists, so the link was a placeholder. */}
        </div>
      </div>
    </section>
  )
}

function StatusBadge({ status, dot, tooltip, pos }: BadgeSpec) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 group"
      style={{ top: pos.top, left: pos.left }}
    >
      <div
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-sans font-medium text-white border border-white/10 nx-pulse-subtle"
        style={{ background: 'rgba(26,26,26,0.88)' }}
      >
        <span
          aria-hidden
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: dot }}
        />
        {status}
      </div>
      {/* Tooltip — shows on hover after 300ms delay */}
      <div
        role="tooltip"
        className="absolute left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1.5 rounded-md bg-m-charcoal text-white text-[11px] leading-[1.4] whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 [transition-delay:300ms] pointer-events-none"
      >
        {tooltip}
      </div>
    </div>
  )
}
