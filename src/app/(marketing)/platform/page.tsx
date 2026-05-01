// ============================================
// /platform — 10-section product tour.
// Rebuilt 2026-04-28 (Batch 1 site refinement).
//
// Replaces the prior thin LandingPlatformModules + LandingProductDemo
// + LandingDemoExplainer combination, which read like a homepage echo.
// New structure (verbatim copy from Kaitlyn's Batch 1 spec):
//
//   1.  Platform Hero
//   2.  Connected Workflow Map
//   3.  Interactive Product Tour (8 module tabs)
//   4.  One Customer, One Item History
//   5.  Owner Command Centre (8 cards)
//   6.  Role-Based Views (4 cards)
//   7.  Digital Passport Integration
//   8.  Migration & Setup (6 steps)
//   9.  Security & Trust mini
//   10. Final CTA
//
// Module tabs render every panel's content into the DOM at all times
// (visibility toggled via `hidden`) so the content stays indexable
// by search and by accessibility tools — addresses the bug Kaitlyn
// flagged on /features where tab contents were not in the static HTML.
// ============================================

import PlatformPageClient from './PlatformPageClient'

export const metadata = {
  title: 'Platform — Nexpura',
  description:
    'The jewellery operating system behind every sale, repair, bespoke order, and passport. Tour the modules, the workflow, and the owner command centre.',
  openGraph: {
    title: 'Platform — Nexpura',
    description:
      'Tour the eight modules, the workflow, and the owner command centre that make up the Nexpura platform.',
    images: ['/og-image.png'],
    type: 'website',
    siteName: 'Nexpura',
  },
}

export default function PlatformPage() {
  return <PlatformPageClient />
}
