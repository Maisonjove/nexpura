'use client'

// ============================================
// Sticky table-of-contents sidebar for legal pages (Privacy, Terms).
// Per Kaitlyn 2026-04-26 editorial-refinement pass.
//
// Active state is driven by an IntersectionObserver: as the user scrolls,
// the topmost intersecting <section id="..."> wins. Clicking a link
// triggers smooth scroll (browser default for hash links + the global
// scroll-margin-top rule from globals.css).
//
// Inactive items: softer #5A554C, no underline, hover darkens to charcoal.
// Active item: charcoal + medium weight + a 2px gold left-bar indicator.
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

    // Track which sections are currently intersecting and which is closest
    // to the top. The top one wins as the active anchor.
    const visible = new Map<string, number>() // id → top distance from header

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
        // Pick the section whose top is closest to (but at or below) the
        // header offset. Sort ascending by distance and take the first
        // non-negative one; if all are negative (scrolled past), pick
        // the last one (closest to 0 from below).
        const sorted = [...visible.entries()].sort((a, b) => a[1] - b[1])
        const firstAtOrBelow = sorted.find(([, top]) => top >= 0)
        const next = firstAtOrBelow ? firstAtOrBelow[0] : sorted[sorted.length - 1][0]
        setActiveId(next)
      },
      {
        // Match scroll-margin-top (~88px) so the active rule fires
        // exactly when a section's heading hits the bottom edge of
        // the sticky header.
        rootMargin: '-88px 0px -60% 0px',
        threshold: [0, 0.1],
      }
    )

    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [items])

  return (
    <nav aria-label="Contents" className="lg:sticky lg:top-[88px] lg:self-start">
      <h2 className="font-sans text-[0.7rem] font-medium uppercase tracking-[0.22em] text-[#8A8276] mb-6">
        Contents
      </h2>
      <ul role="list" className="space-y-1">
        {items.map(({ id, title }) => {
          const isActive = id === activeId
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={() => setActiveId(id)}
                className={
                  isActive
                    ? 'relative block py-2 pl-4 transition-all duration-200 font-sans text-[0.92rem] font-medium leading-[1.5] text-m-charcoal before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[2px] before:h-4 before:bg-[#C9A24A]'
                    : 'relative block py-2 pl-4 transition-all duration-200 font-sans text-[0.92rem] font-normal leading-[1.5] text-[#5A554C] hover:text-m-charcoal'
                }
              >
                {title}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
