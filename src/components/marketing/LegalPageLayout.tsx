// ============================================
// Legal page shell — editorial overhaul per Kaitlyn 2026-04-26.
// Replaces the prior "compact + 2-col TOC" treatment with a stronger
// editorial framing:
//
//   - Hero is left-aligned, with the eyebrow ("Legal") on the left and
//     "Updated · {date}" on the right of a top split row, then a large
//     restrained serif title, then a 12px-wide gold rule that acts as
//     a punctuation mark — "the editorial begins here."
//
//   - Body is a centred 640px reading column with a sticky 180px TOC
//     in the left margin on lg+ (kept as a 2-col grid; the visually
//     quieter approach Kaitlyn called out as an acceptable fallback to
//     a true floating margin, which is the more reliable layout).
//
//   - Each section opens with a serif gold numeral (01, 02, 03…) plus
//     a thin border-line stretching to the column edge — the page's
//     section break. No card backgrounds, no box borders.
//
//   - Section heading is sans-serif, font-medium, 1.35→1.55rem.
//
//   - Body paragraphs: leading-1.75, #3F3A33, max-w-640px column.
//
//   - First paragraph of section 01 has a serif drop cap (one per page,
//     classic editorial signal). All others read normal.
//
//   - The page closes quietly with a single muted "contact us" line.
//     No CTA, no "Talk to the team" link.
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
  const tocItems = sections.map(({ id, title }) => ({ id, title }))

  return (
    <div className="bg-m-ivory">
      {/* === Hero — left-aligned, split top row, large serif title, gold rule */}
      <header className="px-6 pt-20 pb-16 md:pt-24 md:pb-20">
        <div className="mx-auto max-w-5xl">
          {/* Top row: eyebrow on left, "Updated" on right */}
          <div className="flex items-center justify-between mb-12 md:mb-16">
            <span className="font-sans text-[0.7rem] font-medium uppercase tracking-[0.28em] text-[#8A8276]">
              Legal
            </span>
            <span className="font-sans text-[0.78rem] text-[#8A8276] tabular-nums">
              Updated · {lastUpdated}
            </span>
          </div>

          {/* Title — left-aligned, large but restrained */}
          <h1 className="font-serif text-m-charcoal text-[2.4rem] md:text-[3.2rem] lg:text-[3.6rem] leading-[1.05] tracking-[-0.015em] max-w-[680px]">
            {pageTitle}
          </h1>

          {/* 12px gold rule — single decorative flourish */}
          <div aria-hidden="true" className="mt-12 md:mt-16 w-12 h-px bg-[#C9A24A]" />
        </div>
      </header>

      {/* === Body — 2-col grid: sticky 180px TOC + centred 640px reading column */}
      <div className="px-6 pb-20 md:pb-28">
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)] gap-12 lg:gap-16">
          {/* TOC — desktop only, sits in left margin, sticks while scrolling */}
          <aside className="hidden lg:block lg:sticky lg:top-32 lg:self-start">
            <LegalTOC items={tocItems} />
          </aside>

          {/* Body — centred reading column at max-w-640 */}
          <article className="max-w-[640px] mx-auto lg:mx-0 w-full">
            {sections.map((s, i) => {
              const num = String(i + 1).padStart(2, '0')
              const isFirst = i === 0
              // Drop cap applied via Tailwind arbitrary variant — only on
              // section 01's first <p>. One drop cap per page; classic
              // editorial signal.
              const bodyClass = isFirst
                ? 'space-y-5 font-sans text-[0.97rem] md:text-[1rem] leading-[1.75] text-[#3F3A33] [&>p:first-of-type]:first-letter:font-serif [&>p:first-of-type]:first-letter:text-[3.5rem] [&>p:first-of-type]:first-letter:leading-[0.9] [&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:mr-3 [&>p:first-of-type]:first-letter:mt-1 [&>p:first-of-type]:first-letter:text-m-charcoal'
                : 'space-y-5 font-sans text-[0.97rem] md:text-[1rem] leading-[1.75] text-[#3F3A33]'

              return (
                <section
                  key={s.id}
                  id={s.id}
                  aria-labelledby={`${s.id}-heading`}
                  className={isFirst ? 'scroll-mt-32' : 'scroll-mt-32 mt-20 md:mt-24'}
                >
                  {/* Numbered break — serif gold numeral + line to right edge */}
                  <div className="flex items-baseline gap-4 mb-3">
                    <span className="font-serif text-[#C9A24A] text-[0.95rem] tabular-nums tracking-wide">
                      {num}
                    </span>
                    <span aria-hidden="true" className="flex-1 h-px bg-[#E4DBC9]" />
                  </div>

                  <h2
                    id={`${s.id}-heading`}
                    className="font-sans text-m-charcoal text-[1.35rem] md:text-[1.55rem] font-medium leading-[1.25] mb-6 tracking-[-0.005em]"
                  >
                    {s.title}
                  </h2>

                  <div className={bodyClass}>
                    <p>{s.body}</p>
                  </div>
                </section>
              )
            })}

            {/* Quiet closing note — no CTA, no link cluster, just contact */}
            <p className="mt-20 md:mt-24 font-sans text-[0.85rem] text-[#8A8276]">
              For questions about this policy, contact us at hello@nexpura.com.
            </p>
          </article>
        </div>
      </div>
    </div>
  )
}
