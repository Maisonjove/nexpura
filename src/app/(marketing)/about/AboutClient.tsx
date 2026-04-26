// ============================================
// About — restyled to the homepage token system per Kaitlyn 2026-04-26
// polish-pass brief.
//
// Section order (Hero → Mission → Pillars → Principles → CTA → Footer)
// matches the spec verbatim. The previous version used framer-motion
// for blur/fade entrances; that's been removed in favour of the same
// static-token approach the homepage uses (m-reveal handles the gentle
// fade-in via CSS). All body copy is font-sans; only the page H1, the
// section H2s, and the pillar tile titles use the site serif.
// ============================================

import Link from 'next/link'
import { SECTION_PADDING, HEADING, INTRO_SPACING, CARD, BUTTON, CONTAINER } from '@/components/landing/_tokens'

type Pillar = {
  title: string
  sub: string
}

const PILLARS: Pillar[] = [
  { title: 'Repairs', sub: 'Tracked end to end' },
  { title: 'Bespoke', sub: 'Structured commission workflow' },
  { title: 'Inventory', sub: 'Real-time stock visibility' },
  { title: 'Passports', sub: 'Digital trust after the sale' },
]

type Principle = {
  number: string
  title: string
  body: string
}

const PRINCIPLES: Principle[] = [
  {
    number: '01',
    title: 'Purpose-built for jewellery',
    body:
      'We build around real jewellery workflows — repairs, bespoke orders, inventory, customer records, and digital trust — not watered-down retail templates.',
  },
  {
    number: '02',
    title: 'Your data stays yours',
    body:
      'Customer records, stock history, repair notes, sales data, and business intelligence belong to your business.',
  },
  {
    number: '03',
    title: 'Support beyond software',
    body:
      'Nexpura supports implementation with guided migration, onboarding, and practical help when your team needs it.',
  },
]

export default function AboutClient() {
  return (
    <div className="bg-m-ivory">
      {/* === Hero — compact tier per Kaitlyn ============================ */}
      <section
        id="about-hero"
        className={`${SECTION_PADDING.compact} text-center`}
        aria-labelledby="about-hero-heading"
      >
        <div className={`${CONTAINER.narrow}`}>
          <span className={HEADING.eyebrow}>Our Story</span>
          <h1
            id="about-hero-heading"
            className="font-serif text-m-charcoal text-[2.25rem] sm:text-[2.6rem] md:text-[3rem] leading-[1.1] tracking-[-0.01em] mb-5"
          >
            Built exclusively for jewellers
          </h1>
          <p className="font-sans text-m-text-secondary text-[1rem] md:text-[1.1rem] leading-[1.55] max-w-[640px] mx-auto">
            Nexpura was built for jewellery businesses that need more than
            generic retail software. Repairs, bespoke commissions, high-value
            inventory, customer relationships, and digital trust all require
            structure. Nexpura brings those workflows into one modern operating
            system designed specifically for the trade.
          </p>
        </div>
      </section>

      {/* === Mission — standard tier ==================================== */}
      <section
        id="about-mission"
        className={`${SECTION_PADDING.standard}`}
        aria-labelledby="about-mission-heading"
      >
        <div className={`${CONTAINER.narrow} text-center`}>
          <span className={HEADING.eyebrow}>Our Mission</span>
          <h2 id="about-mission-heading" className={HEADING.h2}>
            Give jewellers the operating system they should have had years ago.
          </h2>
          <p className={`${HEADING.subhead} max-w-[680px] mx-auto`}>
            Nexpura connects the daily work of jewellery businesses — POS,
            repairs, bespoke jobs, inventory, customers, invoicing, digital
            passports, and reporting — so teams can run with more visibility,
            structure, and confidence.
          </p>
        </div>
      </section>

      {/* === Product pillars (Migration → Passports) ==================== */}
      <section
        id="about-pillars"
        className={`${SECTION_PADDING.standard}`}
        aria-labelledby="about-pillars-heading"
      >
        <div className={CONTAINER.wide}>
          <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
            <h2 id="about-pillars-heading" className={HEADING.h2}>
              The product, in four pillars
            </h2>
          </div>
          <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
            {PILLARS.map((p) => (
              <li
                key={p.title}
                className={`flex flex-col ${CARD.base} ${CARD.paddingStandard} ${CARD.hover}`}
              >
                <h3 className={HEADING.h3}>{p.title}</h3>
                <p className="mt-2 font-sans text-m-text-secondary text-[0.95rem] leading-[1.55]">
                  {p.sub}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* === Principles ================================================= */}
      <section
        id="about-principles"
        className={`${SECTION_PADDING.standard}`}
        aria-labelledby="about-principles-heading"
      >
        <div className={CONTAINER.wide}>
          <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
            <h2 id="about-principles-heading" className={HEADING.h2}>
              Principles behind the platform
            </h2>
          </div>
          <ol role="list" className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {PRINCIPLES.map((p) => (
              <li key={p.number} className="flex flex-col">
                <span className="font-sans text-[0.85rem] tabular-nums tracking-[0.05em] text-[#C9A24A] font-medium mb-3">
                  {p.number}
                </span>
                <h3 className={`${HEADING.h3} mb-3`}>{p.title}</h3>
                <p className="font-sans text-[0.95rem] leading-[1.6] text-m-text-secondary">
                  {p.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* === Final CTA — standard tier ================================== */}
      <section
        id="about-cta"
        className={`${SECTION_PADDING.standard}`}
        aria-labelledby="about-cta-heading"
      >
        <div className={`${CONTAINER.narrow} text-center`}>
          <h2
            id="about-cta-heading"
            className={HEADING.h2Closing}
          >
            See how Nexpura fits your jewellery business
          </h2>
          <p className={`${HEADING.subhead} max-w-[620px] mx-auto`}>
            Start free or book a personalised walkthrough built around your
            current POS, repair, bespoke, inventory, and customer workflows.
          </p>
          <div className="mt-8 md:mt-9 flex flex-wrap justify-center gap-3 md:gap-4">
            <Link href="/signup" className={BUTTON.primary}>Start Free Trial</Link>
            <Link href="/contact" className={BUTTON.secondary}>Book a Demo</Link>
          </div>
          <p className="mt-6 font-sans text-[0.88rem] text-[#8A8276]">
            14-day free trial <span aria-hidden="true" className="text-[#B9B0A1]">·</span> Guided setup available
          </p>
        </div>
      </section>
    </div>
  )
}
