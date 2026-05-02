import Card from './ui/Card'
import SectionHeader from './ui/SectionHeader'
import { SECTION_PADDING } from './_tokens'

/**
 * Pain points per Kaitlyn's 2026-04-26 spec (PR #42 revision). 2x2 grid
 * on desktop, with each card carrying a permanently-visible solution
 * pill anchored flush to the bottom (via flex-1 on the body) so the
 * four cards align regardless of body length.
 */

interface Pain {
  title: string
  body: string
  solution: string
}

const PAINS: readonly Pain[] = [
  {
    title: 'Repairs fall through the cracks',
    body: 'Paper envelopes, scattered messages, loose notes, and verbal updates make it too easy for jobs to be delayed, forgotten, or chased manually.',
    solution: 'Repair Tracker',
  },
  {
    title: 'Stock visibility gets unclear',
    body: 'Pieces are sold, reserved, moved, on memo, or unavailable before the team has one clean view of what is actually in stock.',
    solution: 'Inventory Intelligence',
  },
  {
    title: 'Bespoke jobs become messy',
    body: 'Quotes, sketches, stones, deposits, approvals, sourcing notes, and production updates end up scattered across too many places.',
    solution: 'Bespoke Orders',
  },
  {
    title: 'Customers keep chasing updates',
    body: 'Without live job statuses, staff spend time answering calls instead of moving repairs, collections, and approvals forward.',
    solution: 'Customer Updates',
  },
] as const

export default function LandingPainPoints() {
  return (
    <section className={`bg-white ${SECTION_PADDING.standard}`}>
      <div className="max-w-[1200px] mx-auto">
        <SectionHeader
          title="Jewellery workflows were never built for generic POS"
          subtitle="Repairs, stock, bespoke jobs, and customer updates become messy when they live across notebooks, spreadsheets, messages, and memory."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 lg:gap-6 mt-10">
          {PAINS.map((pain) => (
            <Card
              key={pain.title}
              as="article"
              className="flex flex-col m-reveal"
            >
              <h3 className="font-serif text-[20px] leading-[1.25] text-m-charcoal">{pain.title}</h3>
              <p className="mt-3 text-[15px] leading-[1.6] text-m-text-secondary flex-1">{pain.body}</p>
              <div className="mt-6 self-start">
                <span className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[0.78rem] leading-none bg-[#F1E9D8] border border-[#E4DBC9] text-[#5A554C]">
                  Solved by {pain.solution}
                </span>
              </div>
            </Card>
          ))}
        </div>

        {/* Batch 4: removed onward CTA "See how the platform fits together". */}
      </div>
    </section>
  )
}
