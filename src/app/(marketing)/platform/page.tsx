import LandingPlatformModules from '@/components/landing/LandingPlatformModules'
import LandingScreenshots from '@/components/landing/LandingScreenshots'
import LandingDemoExplainer from '@/components/landing/LandingDemoExplainer'
import Button from '@/components/landing/ui/Button'

export const metadata = {
  title: 'Platform — Nexpura',
  description:
    'The complete operating system for jewellery businesses. POS, inventory, repairs, bespoke orders, CRM, invoicing, analytics, digital passports, and AI — all connected.',
}

/**
 * /platform — restyled to the homepage system per Kaitlyn brief #2
 * Section 10C. Body content is composed from the three landing
 * components (PlatformModules, Screenshots, DemoExplainer) which
 * already use the m-* tokens; only the page hero + final CTA needed
 * to be brought across.
 */
export default function PlatformPage() {
  return (
    <div className="pt-[72px] bg-m-ivory">
      {/* Page hero */}
      <section className="py-24 lg:py-36 px-6 sm:px-10 lg:px-20 text-center">
        <p className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-6">
          The Platform
        </p>
        <h1 className="font-serif text-[42px] sm:text-[56px] lg:text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[1.06] tracking-[-0.015em] text-m-charcoal mb-6">
          The Nexpura Platform
        </h1>
        <p className="text-[16px] sm:text-[18px] text-m-text-secondary leading-[1.55] max-w-[640px] mx-auto mb-10">
          One connected system for jewellery retail, repairs, bespoke orders, inventory, invoicing, customer records, and digital trust.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Button href="/signup" size="lg">
            Start Free Trial
          </Button>
          <Button href="/contact" variant="tertiary">
            Book a Demo
          </Button>
        </div>
      </section>

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
