'use client'

// ============================================
// Sticky table-of-contents sidebar for legal pages.
// Editorial overhaul per Kaitlyn 2026-04-26 — refined to match the new
// numbered-section body treatment:
//
//   - "CONTENTS" eyebrow at 0.68rem, 0.22em tracking
//   - Each entry: serif gold numeral (matches the body's gold "01"
//     break) + plain-text title
//   - Active state communicated with colour + weight ONLY (no left
//     bar, no background, no border) — gold numeral, charcoal text,
//     font-medium. Inactive: muted #B9B0A1 numeral, #8A8276 text.
//   - Hover: text only darkens to #5A554C
//   - Smaller overall scale (0.82rem) so the TOC reads quieter than
//     the body — it's a navigational aid, not equal weight
//   - IntersectionObserver still drives active state as the visitor
//     scrolls; click sets active immediately
// ============================================

import { useEffect, useState } from 'react'

type TOCItem = { id: string; title: string }

export default function LegalTOC({ items }: { items: TOCItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '')

  useEffect(() => {
    const sections = items
      .map(({ id }) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)

    if (sections.length === 0) return

    const visible = new Map<string, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (entry.isIntersecting) {
            visible.set(id, entry.boundingClientRect.top)
          } else {
            visible.delete(id)
          }
        }
        if (visible.size === 0) return
        const sorted = [...visible.entries()].sort((a, b) => a[1] - b[1])
        const firstAtOrBelow = sorted.find(([, top]) => top >= 0)
        const next = firstAtOrBelow ? firstAtOrBelow[0] : sorted[sorted.length - 1][0]
        setActiveId(next)
      },
      {
        rootMargin: '-128px 0px -60% 0px', // matches scroll-mt-32 (128px)
        threshold: [0, 0.1],
      }
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [items])

  return (
    <nav aria-label="Contents" className="font-sans text-[0.82rem]">
      <span className="block font-medium uppercase tracking-[0.22em] text-[#8A8276] text-[0.68rem] mb-6">
        Contents
      </span>

      <ol role="list" className="space-y-3.5 list-none pl-0">
        {items.map((s, i) => {
          const isActive = activeId === s.id
          const num = String(i + 1).padStart(2, '0')
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={() => setActiveId(s.id)}
                className={
                  isActive
                    ? 'group flex items-baseline gap-3 transition-colors duration-200 text-m-charcoal'
                    : 'group flex items-baseline gap-3 transition-colors duration-200 text-[#8A8276] hover:text-[#5A554C]'
                }
              >
                <span
                  className={
                    isActive
                      ? 'font-serif text-[0.7rem] tabular-nums flex-shrink-0 transition-colors duration-200 text-[#C9A24A]'
                      : 'font-serif text-[0.7rem] tabular-nums flex-shrink-0 transition-colors duration-200 text-[#B9B0A1]'
                  }
                >
                  {num}
                </span>
                <span
                  className={
                    isActive
                      ? 'leading-[1.4] font-medium'
                      : 'leading-[1.4] font-normal'
                  }
                >
                  {s.title}
                </span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
