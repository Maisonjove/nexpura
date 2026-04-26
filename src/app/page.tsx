// Landing page - no auth check needed
import LandingHeader from '@/components/landing/LandingHeader'
import LandingHero from '@/components/landing/LandingHero'
import LandingWhoItsFor from '@/components/landing/LandingWhoItsFor'
import LandingPainPoints from '@/components/landing/LandingPainPoints'
import LandingRepairs from '@/components/landing/LandingRepairs'
import LandingPlatformModules from '@/components/landing/LandingPlatformModules'
import LandingScreenshots from '@/components/landing/LandingScreenshots'
import LandingMigration from '@/components/landing/LandingMigration'
import LandingDigitalPassports from '@/components/landing/LandingDigitalPassports'
import LandingInventory from '@/components/landing/LandingInventory'
import LandingComparison from '@/components/landing/LandingComparison'
import LandingDemoExplainer from '@/components/landing/LandingDemoExplainer'
import LandingFaq from '@/components/landing/LandingFaq'
import LandingCta from '@/components/landing/LandingCta'
import LandingFooter from '@/components/landing/LandingFooter'
import MarketingReveal from '@/components/landing/MarketingReveal'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-m-ivory flex flex-col">
      <LandingHeader />
      <main id="audience" className="flex-1">
        <LandingHero />
        {/* Thin divider in place of the old "Explore the Platform ↓"
            strip + 4-column trust band, both removed per Kaitlyn's
            followup (2026-04-26): the new single-line trust row in the
            hero makes that band redundant. */}
        <hr className="nx-hero-divider" />
        <div id="explore-platform" />
        <LandingWhoItsFor />
        <LandingPainPoints />
        <LandingRepairs />
        <LandingPlatformModules />
        <LandingMigration />
        <LandingScreenshots />
        <LandingDigitalPassports />
        <LandingInventory />
        <LandingComparison />
        <LandingDemoExplainer />
        <LandingFaq />
        <LandingCta />
      </main>
      <LandingFooter />
      <MarketingReveal />
    </div>
  )
}
