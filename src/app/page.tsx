// Landing page - no auth check needed
import LandingHeader from '@/components/landing/LandingHeader'
import LandingHero from '@/components/landing/LandingHero'
import LandingExplorePlatform from '@/components/landing/LandingExplorePlatform'
import LandingPainPoints from '@/components/landing/LandingPainPoints'
import LandingProductDemo from '@/components/landing/LandingProductDemo'
// import LandingRepairs from '@/components/landing/LandingRepairs' — parked on 2026-04-26 alongside its JSX usage. Repair workflow is already covered in problem section, product demo (Repairs tab), platform modules, comparison, and FAQ; component file kept intact for possible reuse on /platform/repairs.
import LandingPlatformModules from '@/components/landing/LandingPlatformModules'
// LandingScreenshots removed on 2026-04-26 — superseded by LandingProductDemo (same six tabs, repositioned earlier in the page after the problem section). Component file kept at LandingScreenshots.tsx for repurposing.
import LandingAICopilot from '@/components/landing/LandingAICopilot'
import LandingDemoExplainer from '@/components/landing/LandingDemoExplainer'
import LandingDigitalPassport from '@/components/landing/LandingDigitalPassport'
import LandingWhoItsFor from '@/components/landing/LandingWhoItsFor'
import LandingComparison from '@/components/landing/LandingComparison'
import LandingMigrationStrip from '@/components/landing/LandingMigrationStrip'
// import LandingMigration from '@/components/landing/LandingMigration' — parked on 2026-04-26. Replaced on the homepage by the compact LandingMigrationStrip; the long-form section is repurposable for a future /migration page. Component file kept intact.
// import LandingInventory from '@/components/landing/LandingInventory' — parked on 2026-04-26. Inventory is now covered by the Inventory tab in LandingProductDemo and the "Inventory & Memo" card in LandingPlatformModules. Component file kept intact.
import LandingFAQ from '@/components/landing/LandingFAQ'
// import LandingFaq from '@/components/landing/LandingFaq' — replaced 2026-04-26 by the new 5-question LandingFAQ.tsx (capital filename). Old file kept on disk for repurposing.
import LandingFinalCTA from '@/components/landing/LandingFinalCTA'
// import LandingCta from '@/components/landing/LandingCta' — replaced 2026-04-26 by LandingFinalCTA. Old file kept on disk for repurposing.
import LandingFooter from '@/components/landing/LandingFooter'
import MarketingReveal from '@/components/landing/MarketingReveal'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-m-ivory flex flex-col">
      <LandingHeader />
      <main id="audience" className="flex-1">
        <LandingHero />
        <LandingExplorePlatform />
        <LandingPainPoints />
        <LandingProductDemo />
        {/* <LandingRepairs /> — parked on 2026-04-26. Repair workflow is already covered in problem section, product demo (Repairs tab), platform modules, comparison, and FAQ. Removing avoids duplication and trims homepage length. */}
        <LandingPlatformModules />
        <LandingAICopilot />
        <LandingDemoExplainer />
        {/* LandingScreenshots removed 2026-04-26 — content moved into LandingProductDemo above and repositioned after the problem section. */}
        <LandingDigitalPassport />
        <LandingWhoItsFor />
        <LandingComparison />
        {/* <LandingInventory /> — parked on 2026-04-26. Inventory is already covered by the Inventory tab in Product Demo and the "Inventory & Memo" card in Platform Modules. Removing the standalone section to avoid triple-coverage and keep the homepage tight. */}
        {/* <LandingMigration /> — parked on 2026-04-26. Long-form migration content moved to a tighter 3-step LandingMigrationStrip below; the original component is the foundation for a future /migration page. */}
        <LandingMigrationStrip />
        <LandingFAQ />
        <LandingFinalCTA />
      </main>
      <LandingFooter />
      <MarketingReveal />
    </div>
  )
}
