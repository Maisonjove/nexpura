// ============================================
// About — rewritten for Batch 2 (Kaitlyn 2026-04-28).
//
// The previous version mirrored the homepage too closely (feature list,
// "Run the workflows" CTA, generic mission copy). This rewrite gives
// the page its own job:
//   - WHY Nexpura exists (the categories of tools jewellers outgrow)
//   - WHY jewellery deserves its own operating system
//   - PRODUCT PHILOSOPHY (operational, not flashy)
//   - STANDARDS (security, data ownership, customer trust)
//   - Closing CTA pointing onward at Trial / Platform
//
// No founder bio block — there's no approved photo + copy on disk yet.
// Adding one with placeholder content would be invented content. If
// Kaitlyn supplies a founder note, it slots cleanly between the
// Standards section and the closing CTA.
// ============================================

import Link from 'next/link'
import { SECTION_PADDING, HEADING, INTRO_SPACING, CARD, BUTTON, CONTAINER } from '@/components/landing/_tokens'

type Outgrown = {
  title: string
  body: string
}

const OUTGROWN_TOOLS: Outgrown[] = [
  {
    title: 'Generic POS',
    body:
      'Built for checkout. Treats a repair, a bespoke commission, and a memo loan as if they were the same transaction.',
  },
  {
    title: 'Spreadsheets',
    body:
      'Capture data, but not workflow — and quietly drift out of sync between staff, locations, and devices.',
  },
  {
    title: 'Paper repair books',
    body:
      'Hold the job, but lose the timeline, the photos, the deposits, the customer updates, and the search history.',
  },
  {
    title: 'Disconnected customer records',
    body:
      'A name in the till, a number in your phone, a thread in WhatsApp. None of it tells you who they are.',
  },
]

type Principle = {
  number: string
  title: string
  body: string
}

const PRINCIPLES: Principle[] = [
  {
    number: '01',
    title: 'Built for the floor, not the demo',
    body:
      'Every screen is designed to be used during a real shift — at the counter, at the bench, on a service call — by people who have customers waiting.',
  },
  {
    number: '02',
    title: 'Operational over flashy',
    body:
      'We add a feature when it removes a manual step or a known failure mode. We do not add it because it looks good in a deck.',
  },
  {
    number: '03',
    title: 'One record, many lenses',
    body:
      'A piece, a customer, a job, a sale — they should all read the same on the till, in the workshop, and in the customer’s aftercare email. One source of truth, surfaced where it is needed.',
  },
]

type Standard = {
  title: string
  body: string
}

const STANDARDS: Standard[] = [
  {
    title: 'Your data is yours',
    body:
      'Customer records, stock history, repair notes, and sales data belong to your business. You can export them, segment them, and take them with you.',
  },
  {
    title: 'Security as default',
    body:
      'Role-based access, audit trails, and encrypted transport are how the platform ships — not options to opt into.',
  },
  {
    title: 'Customer trust by design',
    body:
      'Digital passports, verifiable provenance, and aftercare records give your customers something to keep — not just a receipt to lose.',
  },
]

export default function AboutClient() {
  return (
    <div className="bg-m-ivory">
      {/* === Hero ====================================================== */}
      <section
        id="about-hero"
        className={`${SECTION_PADDING.compact} text-center`}
        aria-labelledby="about-hero-heading"
      >
        <div className={`${CONTAINER.narrow}`}>
          <span className={HEADING.eyebrow}>Why Nexpura</span>
          <h1
            id="about-hero-heading"
            className="font-serif text-m-charcoal text-[2.25rem] sm:text-[2.6rem] md:text-[3rem] leading-[1.1] tracking-[-0.01em] mb-6"
          >
            An operating system for the jewellery trade.
          </h1>
          <p className="font-sans text-m-text-secondary text-[1rem] md:text-[1.1rem] leading-[1.6] max-w-[680px] mx-auto">
            Nexpura was built for jewellery businesses that have outgrown
            generic POS, spreadsheets, paper repair books, and disconnected
            customer records.
          </p>
        </div>
      </section>

      {/* === What jewellers outgrow =================================== */}
      <section
        id="about-outgrown"
        className={`${SECTION_PADDING.standard}`}
        aria-labelledby="about-outgrown-heading"
      >
        <div className={CONTAINER.wide}>
          <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
            <h2 id="about-outgrown-heading" className={HEADING.h2}>
              What jewellers outgrow
            </h2>
            <p className={`${HEADING.subhead} max-w-[640px] mx-auto`}>
              The tools most independents start with stop scaling at exactly
              the moment the business does.
            </p>
          </div>
          <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
            {OUTGROWN_TOOLS.map((t) => (
              <li
                key={t.title}
                className={`flex flex-col ${CARD.base} ${CARD.paddingStandard} ${CARD.hover}`}
              >
                <h3 className={HEADING.h3}>{t.title}</h3>
                <p className="mt-3 font-sans text-m-text-secondary text-[0.97rem] leading-[1.6]">
                  {t.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* === Why jewellery needs its own system ======================= */}
      <section
        id="about-category"
        className={`${SECTION_PADDING.standard}`}
        aria-labelledby="about-category-heading"
      >
        <div className={`${CONTAINER.narrow} text-center`}>
          <span className={HEADING.eyebrow}>The category</span>
          <h2 id="about-category-heading" className={HEADING.h2}>
            Jewellery isn&apos;t retail.
          </h2>
          <p className={`${HEADING.subhead} max-w-[680px] mx-auto`}>
            A repair holds emotional weight. A bespoke commission holds
            months of trust. A piece outlives the receipt. Generic retail
            software treats every transaction as the same; jewellery
            businesses live with the consequences when it doesn&apos;t.
            Nexpura is designed around the parts of the work that other
            categories don&apos;t have.
          </p>
        </div>
      </section>

      {/* === Product philosophy ======================================= */}
      <section
        id="about-principles"
        className={`${SECTION_PADDING.standard}`}
        aria-labelledby="about-principles-heading"
      >
        <div className={CONTAINER.wide}>
          <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
            <span className={HEADING.eyebrow}>How we build</span>
            <h2 id="about-principles-heading" className={HEADING.h2}>
              Product philosophy
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

      {/* === Standards / what we work to ============================== */}
      <section
        id="about-standards"
        className={`${SECTION_PADDING.standard}`}
        aria-labelledby="about-standards-heading"
      >
        <div className={CONTAINER.wide}>
          <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
            <span className={HEADING.eyebrow}>Standards</span>
            <h2 id="about-standards-heading" className={HEADING.h2}>
              The standards we work to
            </h2>
          </div>
          <ul role="list" className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            {STANDARDS.map((s) => (
              <li
                key={s.title}
                className={`flex flex-col ${CARD.base} ${CARD.paddingStandard} ${CARD.hover}`}
              >
                <h3 className={HEADING.h3}>{s.title}</h3>
                <p className="mt-3 font-sans text-m-text-secondary text-[0.97rem] leading-[1.6]">
                  {s.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* === Final CTA — Batch 2 lock ================================= */}
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
            See why jewellery businesses are switching to Nexpura.
          </h2>
          <div className="mt-8 md:mt-9 flex flex-wrap justify-center gap-3 md:gap-4">
            <Link href="/signup" className={BUTTON.primary}>Start Free Trial</Link>
            <Link href="/platform" className={BUTTON.secondary}>See the Platform</Link>
          </div>
          <p className="mt-6 font-sans text-[0.88rem] text-[#8A8276]">
            14-day free trial <span aria-hidden="true" className="text-[#B9B0A1]">·</span> No charge today <span aria-hidden="true" className="text-[#B9B0A1]">·</span> Cancel anytime before your trial ends
          </p>
        </div>
      </section>
    </div>
  )
}
