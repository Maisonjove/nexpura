'use client'

import { useEffect } from 'react'

/**
 * Mounts a single IntersectionObserver that toggles `.is-visible` on
 * every `.m-reveal` element when it enters the viewport. Used by
 * marketing-site sections (Trust Strip, audience cards, comparison
 * rows, etc.) for the brief's "fade up on scroll into view" pattern
 * without each section needing its own observer.
 *
 * Honours `prefers-reduced-motion` — the CSS rule strips the animation
 * and keeps everything visible from the start.
 */
export default function MarketingReveal() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const els = document.querySelectorAll<HTMLElement>('.m-reveal')
    if (els.length === 0) return

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => el.classList.add('is-visible'))
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '-10% 0px -10% 0px', threshold: 0.05 },
    )

    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return null
}
