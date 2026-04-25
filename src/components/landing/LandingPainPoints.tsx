import Card from './ui/Card'
import SectionHeader from './ui/SectionHeader'

/**
 * Pain points per Kaitlyn's brief (section 8). On hover each card
 * reveals a champagne-bordered "Nexpura solves this with → <module>"
 * footer (200ms fade), so the section actively bridges the problem
 * statement to the solution.
 */

interface Pain {
  title: string
  body: string
  solution: string
}

const PAINS: readonly Pain[] = [
  {
    title: 'Repairs fall through the cracks',
    body: 'Jobs get lost. Customers call chasing updates. Staff rely on memory.',
    solution: 'Repair Tracker',
  },
  {
    title: 'Stock visibility is unclear',
    body: 'You find out something is sold, reserved, missing, or unavailable too late.',
    solution: 'Inventory Intelligence',
  },
  {
    title: 'Bespoke jobs live in too many places',
    body: 'Quotes, notes, photos, approvals, and deposits are scattered across messages and notebooks.',
    solution: 'Bespoke Orders',
  },
  {
    title: 'Customers keep chasing updates',
    body: 'Without live statuses, every job creates more calls, confusion, and admin.',
    solution: 'Customer Updates',
  },
] as const

export default function LandingPainPoints() {
  return (
    <section className="bg-white py-24 lg:py-32 px-6 sm:px-12">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeader
          title="Still running jewellery workflows across notebooks, spreadsheets, and messages?"
          subtitle="Nexpura replaces disconnected tools with one connected operating system built around the way jewellers actually work."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 mt-14">
          {PAINS.map((pain) => (
            <Card
              key={pain.title}
              as="article"
              className="group relative overflow-hidden flex flex-col m-reveal !p-0"
            >
              <div className="p-7 flex-1">
                <h3 className="font-serif text-[20px] leading-[1.25] text-m-charcoal">
                  {pain.title}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-m-text-secondary">
                  {pain.body}
                </p>
              </div>

              {/* Solution bridge — fades in on hover, with a champagne
                  top border so the visual ties to the rest of the
                  page's accent palette. */}
              <div
                className="border-t border-m-champagne bg-[#FDFAF4] px-7 py-3 opacity-0 translate-y-1 transition-all duration-200 [transition-timing-function:var(--m-ease)] group-hover:opacity-100 group-hover:translate-y-0"
                aria-hidden
              >
                <span className="text-[12px] tracking-[0.05em] text-m-text-muted">
                  Nexpura solves this with →{' '}
                </span>
                <span className="text-[13px] font-medium text-m-charcoal">{pain.solution}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Bridge statement — re-typed per Kaitlyn's correction Fix #2.
            Serif (matches section H2s), 42px desktop / 32px @≤lg / 26px
            mobile, centered, max-width 920px. The phrase "one connected
            platform" gets a subtle champagne underline highlight using
            a clipped linear-gradient. */}
        <div className="max-w-[920px] mx-auto mt-20 lg:mt-20 px-6 text-center m-reveal">
          <p className="font-serif text-[26px] sm:text-[32px] lg:text-[42px] leading-[1.18] tracking-[-0.01em] text-m-charcoal m-0">
            Nexpura brings every workflow into{' '}
            <span
              className="pb-px"
              style={{
                backgroundImage:
                  'linear-gradient(transparent 92%, rgba(201,169,97,0.45) 92%)',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '100% 100%',
              }}
            >
              one connected platform
            </span>
            , so nothing gets lost, delayed, or disconnected.
          </p>
        </div>
      </div>
    </section>
  )
}
