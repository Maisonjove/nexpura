// Landing page - no auth check needed
import LandingHeader from '@/components/landing/LandingHeader'
import LandingHero from '@/components/landing/LandingHero'
import LandingExplorePlatform from '@/components/landing/LandingExplorePlatform'
// import LandingWhoItsFor from '@/components/landing/LandingWhoItsFor' — parked on 2026-04-26 alongside its JSX usage. Component file kept intact.
import LandingPainPoints from '@/components/landing/LandingPainPoints'
import LandingProductDemo from '@/components/landing/LandingProductDemo'
// import LandingRepairs from '@/components/landing/LandingRepairs' — removed on 2026-04-26 alongside its JSX usage. Repair workflow is already covered in problem section, product demo (Repairs tab), platform modules, comparison, and FAQ; component file kept intact for possible reuse on /platform/repairs.
import LandingPlatformModules from '@/components/landing/LandingPlatformModules'
// LandingScreenshots removed on 2026-04-26 — superseded by LandingProductDemo (same six tabs, repositioned earlier in the page after the problem section). Component file kept at LandingScreenshots.tsx for repurposing.
import LandingAICopilot from '@/components/landing/LandingAICopilot'
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
        <LandingExplorePlatform />
        {/* <LandingWhoItsFor /> — parked on 2026-04-26. May reposition later, possibly after the Digital Passport section. Component file kept intact. */}
        <LandingPainPoints />
        <LandingProductDemo />
        {/* <LandingRepairs /> — removed on 2026-04-26. Repair workflow is already covered in problem section, product demo (Repairs tab), platform modules, comparison, and FAQ. Removing avoids duplication and trims homepage length. */}
        <LandingPlatformModules />
        <LandingAICopilot />
        <LandingMigration />
        {/* LandingScreenshots removed 2026-04-26 — content moved into LandingProductDemo above and repositioned after the problem section. */}
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
