import Link from 'next/link'
import Card from './ui/Card'
import Tag from './ui/Tag'
import SectionHeader from './ui/SectionHeader'

/**
 * "Built for every corner of the jewellery trade" per Kaitlyn's brief
 * (section 7). Four cards: small line icon top-left, serif title, body,
 * tag row, "Explore workflow" link with arrow that slides on hover.
 */

interface Audience {
  title: string
  body: string
  tags: readonly string[]
  cta: string
  href: string
  Icon: () => React.ReactElement
}

const SEGMENTS: readonly Audience[] = [
  {
    title: 'Retail Jewellers',
    body: 'Connect POS, inventory, CRM, repairs, and customer records in one retail workspace.',
    tags: ['POS', 'Inventory', 'CRM', 'Repairs'],
    cta: 'See retail workflows',
    href: '/features',
    Icon: RetailIcon,
  },
  {
    title: 'Workshops & Repairs',
    body: 'Track repairs, due dates, staff assignments, customer updates, photos, quotes, and collection readiness.',
    tags: ['Repairs', 'Jobs', 'Staff', 'Updates'],
    cta: 'See repair workflows',
    href: '/features#repairs',
    Icon: WorkshopIcon,
  },
  {
    title: 'Bespoke Studios',
    body: 'Manage custom orders from enquiry to approval, production, deposits, sourcing, and final handover.',
    tags: ['Bespoke', 'Approvals', 'Deposits', 'Sourcing'],
    cta: 'See bespoke workflows',
    href: '/features#bespoke',
    Icon: BespokeIcon,
  },
  {
    title: 'Multi-Store Groups',
    body: 'Centralise stock, customers, reporting, visibility, and operations across every location.',
    tags: ['Locations', 'Stock', 'Reports', 'Teams'],
    cta: 'See multi-store workflows',
    href: '/features',
    Icon: MultiStoreIcon,
  },
] as const

export default function LandingWhoItsFor() {
  return (
    <section className="bg-m-ivory py-24 lg:py-32 px-6 sm:px-12">
      <SectionHeader
        title="Built for every corner of the jewellery trade"
        subtitle="Whether you sell, repair, create, or manage multiple locations, Nexpura connects the workflows your business depends on."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 max-w-[1200px] mx-auto mt-14">
        {SEGMENTS.map(({ title, body, tags, cta, href, Icon }, i) => (
          <Card
            key={title}
            className={`group flex flex-col m-reveal`}
            as="article"
          >
            <div
              className="text-m-charcoal mb-5"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <Icon />
            </div>
            <h3 className="font-serif text-[22px] leading-[1.2] text-m-charcoal">
              {title}
            </h3>
            <p className="mt-3 text-[15px] leading-[1.6] text-m-text-secondary flex-1">
              {body}
            </p>
            <ul className="flex flex-wrap gap-1.5 mt-5">
              {tags.map((t) => (
                <li key={t}>
                  <Tag>{t}</Tag>
                </li>
              ))}
            </ul>
            <Link
              href={href}
              className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-sans font-medium text-m-charcoal hover:underline underline-offset-4 decoration-m-charcoal"
            >
              {cta}
              <span
                aria-hidden
                className="inline-block transition-transform duration-200 [transition-timing-function:var(--m-ease)] group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  )
}

/* ─── Icons (24px line icons, charcoal stroke) ─── */

function RetailIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 7h16l-1 13H5z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  )
}
function WorkshopIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 7l-1.4-1.4a2 2 0 0 0-2.8 0L4 11.4l3 3 5.8-5.8a2 2 0 0 0 0-2.8z" />
      <path d="M14.5 11l4.8 4.8a2 2 0 0 1 0 2.8l-.7.7a2 2 0 0 1-2.8 0L11 14.5" />
    </svg>
  )
}
function BespokeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l8 4.5L12 12 4 7.5z" />
      <path d="M4 7.5v9L12 21l8-4.5v-9" />
      <path d="M12 12v9" />
    </svg>
  )
}
function MultiStoreIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9l1.5-4h15L21 9" />
      <path d="M4 9v11h16V9" />
      <path d="M9 20v-5h6v5" />
    </svg>
  )
}
