// ============================================
// /platform — Kaitlyn 2026-04-26 polish-pass:
//   - Removed the duplicate top hero (eyebrow "The Platform" + H1
//     "The Nexpura Platform" + generic subhead). The first body section
//     is LandingPlatformModules which already opens with "One system
//     of record for every jewellery workflow" — landing visitors at
//     that heading directly is tighter.
//   - Dropped the legacy `pt-[72px]` div wrapper now that the
//     marketing layout's main uses `.page-shell` (88px desktop /
//     72px mobile) for the sticky-header offset.
//   - Final CTA "Book a Demo" href stays /contact (was already
//     correct here).
// ============================================

import LandingPlatformModules from '@/components/landing/LandingPlatformModules'
import LandingScreenshots from '@/components/landing/LandingScreenshots'
import LandingDemoExplainer from '@/components/landing/LandingDemoExplainer'
import Button from '@/components/landing/ui/Button'

export const metadata = {
  title: 'Platform — Nexpura',
  description:
    'The complete operating system for jewellery businesses. POS, inventory, repairs, bespoke orders, CRM, invoicing, analytics, digital passports, and AI — all connected.',
}

export default function PlatformPage() {
  return (
    <div className="bg-m-ivory">
      <LandingPlatformModules />
      <LandingScreenshots />
      <LandingDemoExplainer />

      {/* Final CTA */}
      <section className="py-24 lg:py-32 px-6 sm:px-10 lg:px-20 text-center border-t border-m-border-soft bg-m-charcoal">
        <h2 className="font-serif text-[36px] sm:text-[48px] lg:text-[56px] font-normal leading-[1.12] tracking-[-0.01em] text-white mb-4">
          See how Nexpura fits your workflow
        </h2>
        <p className="text-[15px] text-m-champagne-soft mb-10 max-w-md mx-auto">
          Explore the platform in a personalised walkthrough built around your business.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Button href="/signup" size="lg" className="!bg-white !text-m-charcoal hover:!bg-m-champagne-tint">
            Start Free Trial
          </Button>
          <Button href="/contact" variant="tertiary" className="!text-white after:!bg-white">
            Book a Demo
          </Button>
        </div>
      </section>
    </div>
  )
}
