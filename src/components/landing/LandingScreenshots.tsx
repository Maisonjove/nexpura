'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import SectionHeader from './ui/SectionHeader'
import PassportVerificationMockup from './PassportVerificationMockup'

/**
 * "See Nexpura in action" tabbed product section per Kaitlyn's brief
 * (section 12). Six tabs (Repairs / Inventory / Bespoke / Passport /
 * Analytics / CRM), keyboard accessible (Arrow keys cycle, Enter /
 * Space activates), smooth transitions between tabs (old screen fades
 * out, new fades in + slides up 8px; right copy slides in 12px from
 * right). Mobile: tabs become a horizontal scrollable row.
 */

interface TabContent {
  tab: string
  title: string
  body: string
  bullets: readonly string[]
  /** Only set when the link routes to a verified existing page —
   *  per Kaitlyn's correction Fix #7, placeholder #anchors that don't
   *  exist on /features were stripped to avoid dead clicks. */
  cta?: { label: string; href: string }
  src: string
  alt: string
}

const TABS: readonly TabContent[] = [
  {
    tab: 'Repairs',
    title: 'Repair Tracker',
    body:
      'Every repair is logged, assigned, and tracked from intake to collection, so staff have full visibility and customers get clear updates.',
    bullets: [
      'Log item details, photos, pricing, and due dates',
      'Assign work clearly to team members',
      'Track deposits, balances, and collection readiness',
    ],
    // No CTA — /features has no #repairs anchor; Fix #7 removed.
    src: '/screenshots/repairs.png',
    alt: 'Nexpura Repair Tracker — repair pipeline view',
  },
  {
    tab: 'Inventory',
    title: 'Inventory Intelligence',
    body:
      'Track every piece, stone, metal, and component with live stock status, reservation tracking, location visibility, and item history.',
    bullets: [
      'See live stock status across locations',
      'Track reserved, sold, low-stock, and available pieces',
      'Maintain full movement and item history',
    ],
    // No CTA — /features has no #inventory anchor; Fix #7 removed.
    src: '/screenshots/inventory.png',
    alt: 'Nexpura Inventory — live stock with status badges',
  },
  {
    tab: 'Bespoke',
    title: 'Bespoke Order Management',
    body:
      'Manage custom work from first enquiry to design approval, sourcing, deposit, production, and final handover.',
    bullets: [
      'Keep quotes, notes, images, and approvals together',
      'Track milestones and customer decisions',
      'Connect bespoke jobs to customer records',
    ],
    // No CTA — /features has no #bespoke anchor; Fix #7 removed.
    src: '/screenshots/bespoke.png',
    alt: 'Nexpura Bespoke — milestone timeline and approvals',
  },
  {
    tab: 'Passport',
    title: 'Digital Passport',
    body:
      'Attach a verified record of materials, craftsmanship, provenance, and service history to every important piece.',
    bullets: [
      'Give each piece a customer-friendly record',
      'Add material, stone, and provenance details',
      'Support trust, authenticity, and resale confidence',
    ],
    cta: { label: 'Explore digital passports', href: '/verify' },
    src: '/screenshots/passport.png',
    alt: 'Nexpura Digital Passport — QR-verifiable provenance record',
  },
  {
    tab: 'Analytics',
    title: 'Business Analytics',
    body:
      'Understand sales, stock, repairs, customers, and team performance through clear reporting built for jewellery operations.',
    bullets: [
      'Track sales and workflow performance',
      'Identify slow-moving stock and repair bottlenecks',
      'View business activity across locations',
    ],
    // No CTA — /features has no #analytics anchor; Fix #7 removed.
    src: '/screenshots/analytics.png',
    alt: 'Nexpura Analytics — sales and workshop performance dashboards',
  },
  {
    tab: 'CRM',
    title: 'Jewellery CRM',
    body:
      'Keep customer profiles, purchases, preferences, repairs, bespoke work, and service history connected in one place.',
    bullets: [
      'View full customer history',
      'Record preferences and important dates',
      'Connect customers to purchases, repairs, and passports',
    ],
    // No CTA — /features has no #crm anchor; Fix #7 removed.
    // Falls back to the dashboard screenshot until a dedicated CRM
    // screenshot lands.
    src: '/screenshots/dashboard.png',
    alt: 'Nexpura Jewellery CRM — customer profile with purchase + service history',
  },
] as const

export default function LandingScreenshots() {
  const [active, setActive] = useState(0)
  const tabsRef = useRef<HTMLDivElement>(null)

  // Arrow-key navigation across the tablist.
  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (!target?.matches('[role="tab"]')) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const dir = e.key === 'ArrowRight' ? 1 : -1
        setActive((curr) => (curr + dir + TABS.length) % TABS.length)
        // Re-focus the new active tab on next paint
        requestAnimationFrame(() => {
          const buttons = el?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
          if (!buttons) return
          buttons[(activeRef.current + dir + TABS.length) % TABS.length]?.focus()
        })
      }
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [])

  // Stash the latest active in a ref so the keydown handler reads it
  // without needing to re-bind on every state change.
  const activeRef = useRef(0)
  useEffect(() => {
    activeRef.current = active
  }, [active])

  const current = TABS[active]

  return (
    <section className="bg-white py-24 lg:py-32 px-6 sm:px-12">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeader
          title="See Nexpura in action"
          subtitle="A closer look at the screens your team uses every day."
        />

        {/* Tablist */}
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Product surfaces"
          className="mt-12 flex items-center gap-2 overflow-x-auto pb-2 sm:justify-center [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t, i) => {
            const isActive = i === active
            return (
              <button
                key={t.tab}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`panel-${i}`}
                id={`tab-${i}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(i)}
                className={`shrink-0 px-5 py-2 rounded-full text-[14px] font-sans font-medium transition-all duration-200 [transition-timing-function:var(--m-ease)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne ${
                  isActive
                    ? 'bg-m-charcoal text-white'
                    : 'bg-m-ivory text-m-charcoal border border-m-border-soft hover:bg-m-champagne-soft'
                }`}
              >
                {t.tab}
              </button>
            )
          })}
        </div>

        {/* Panel — fade out + slide-up old, fade-in new on key change */}
        <div
          id={`panel-${active}`}
          role="tabpanel"
          aria-labelledby={`tab-${active}`}
          key={active}
          className="mt-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-10 lg:gap-12 items-start nx-fade-in-blur-up"
        >
          {/* Left panel — screenshot for every tab except Passport, which
              renders the PassportVerificationMockup (Kaitlyn Fix #4). The
              prior bespoke/admin dashboard image confused users about
              what the customer-facing passport surface actually looks
              like. */}
          {current.tab === 'Passport' ? (
            <PassportVerificationMockup />
          ) : (
            <div className="relative rounded-2xl overflow-hidden border border-m-border-soft shadow-[0_8px_32px_rgba(0,0,0,0.08)] bg-white aspect-video">
              <Image
                src={current.src}
                alt={current.alt}
                fill
                sizes="(min-width: 1024px) 720px, 100vw"
                className="object-cover object-top"
                priority={active === 0}
              />
            </div>
          )}

          {/* Copy */}
          <div className="flex flex-col">
            <h3 className="font-serif text-[28px] leading-[1.2] text-m-charcoal">
              {current.title}
            </h3>
            <p className="mt-4 text-[16px] leading-[1.6] text-m-text-secondary">
              {current.body}
            </p>
            <ul className="mt-5 space-y-2.5">
              {current.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 text-[15px] leading-[1.5] text-m-text-secondary"
                >
                  <span
                    aria-hidden
                    className="w-1.5 h-1.5 rounded-full bg-m-champagne shrink-0 mt-2"
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            {current.cta && (
              <Link
                href={current.cta.href}
                className="mt-7 inline-flex items-center gap-1.5 text-[14px] font-sans font-medium text-m-charcoal hover:underline underline-offset-4 decoration-m-charcoal w-fit"
              >
                {current.cta.label}
                <span aria-hidden>→</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
