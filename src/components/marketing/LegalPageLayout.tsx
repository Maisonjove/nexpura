// ============================================
// Shared layout shell for /privacy and /terms (and any future legal
// page). Per Kaitlyn 2026-04-26 editorial-refinement pass:
//   - Tight hero block (eyebrow → title → date) with mb-4 / mt-3
//   - mt-16 md:mt-20 gap before the content area
//   - 220px sticky TOC sidebar + max-w-[640px] body column
//   - Section headings sans-serif medium between H2 and body
//   - Generous mt-14 md:mt-16 between sections, mb-4 below each heading
//   - Body 0.97-1rem leading-1.7 in #3F3A33 for editorial calm
//   - First section heading uses mt-0 so it baselines with the TOC
//     "CONTENTS" eyebrow on desktop
// ============================================

import LegalTOC from './LegalTOC'

export type LegalSection = {
  id: string
  title: string
  body: string
}

type Props = {
  pageTitle: string
  lastUpdated: string
  sections: LegalSection[]
}

export default function LegalPageLayout({ pageTitle, lastUpdated, sections }: Props) {
  return (
    <div className="bg-m-ivory">
      {/* === Hero — compact, tight vertical rhythm =================== */}
      <section className="px-6 py-14 md:py-16 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="inline-block font-sans text-[0.78rem] font-medium uppercase tracking-[0.22em] text-[#8A8276] mb-4">
            Legal
          </span>
          <h1 className="font-serif text-m-charcoal text-[2rem] md:text-[2.4rem] leading-[1.15] tracking-[-0.005em]">
            {pageTitle}
          </h1>
          <p className="mt-3 font-sans text-[0.9rem] text-[#8A8276]">
            Last updated · {lastUpdated}
          </p>
        </div>
      </section>

      {/* === Body grid — 220px sticky TOC + 640px content =========== */}
      <section className="px-6 pb-16 md:pb-20">
        <div className="mx-auto max-w-5xl mt-16 md:mt-20 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-12 lg:gap-16">
          <LegalTOC items={sections.map(({ id, title }) => ({ id, title }))} />

          <div className="max-w-[640px] pt-0">
            {sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                aria-labelledby={`${s.id}-heading`}
                className={i === 0 ? 'mt-0' : 'mt-14 md:mt-16'}
              >
                <h2
                  id={`${s.id}-heading`}
                  className="font-sans text-[1.2rem] md:text-[1.3rem] font-medium leading-[1.3] text-m-charcoal mb-4"
                >
                  {s.title}
                </h2>
                <p className="font-sans text-[0.97rem] md:text-[1rem] leading-[1.7] text-[#3F3A33]">
                  {s.body}
                </p>
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
