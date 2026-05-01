'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Marketing-scope scroll restoration helper. Batch 4 site refinement.
 *
 * Background: Kaitlyn observed that some marketing-page navigations land
 * mid-page or at the bottom of the previous page. We could not pin a
 * single override (no `scroll: false`, no manual `window.scrollTo`,
 * no `useScrollRestoration` in the codebase as of Batch 3), so the most
 * likely culprit is post-render layout shift from lazy-mounted reveals
 * that move the scroll anchor down after the navigation completes.
 *
 * This component force-resets the scroll position to (0,0) on every
 * pathname transition — but only when the URL has no hash, so anchor
 * links like `/#explore-platform` continue to scroll to their target.
 *
 * Mounted in the marketing layout AND on the homepage (which has its
 * own per-page header/footer rather than going through the marketing
 * layout, so it needs the component rendered separately).
 */
export default function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])

  return null
}
