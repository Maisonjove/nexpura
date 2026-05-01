// Landing page - no auth check needed
import Link from 'next/link'
import LandingHeader from '@/components/landing/LandingHeader'
import LandingHero from '@/components/landing/LandingHero'
import LandingExplorePlatform from '@/components/landing/LandingExplorePlatform'
import LandingPainPoints from '@/components/landing/LandingPainPoints'
import LandingProductDemo from '@/components/landing/LandingProductDemo'
// import LandingRepairs from '@/components/landing/LandingRepairs' — parked on 2026-04-26 alongside its JSX usage. Repair workflow is already covered in problem section, product demo (Repairs tab), platform modules, comparison, and FAQ; component file kept intact for possible reuse on /platform/repairs.
import LandingPlatformModules from '@/components/landing/LandingPlatformModules'
// LandingScreenshots removed on 2026-04-26 — superseded by LandingProductDemo (same six tabs, repositioned earlier in the page after the problem section). Component file kept at LandingScreenshots.tsx for repurposing.
import LandingAICopilot from '@/components/landing/LandingAICopilot'
// import LandingDemoExplainer from '@/components/landing/LandingDemoExplainer' — parked on 2026-04-26. Kaitlyn's final order omits this section; component file kept intact for repurposing.
import LandingDigitalPassport from '@/components/landing/LandingDigitalPassport'
import LandingWhoItsFor from '@/components/landing/LandingWhoItsFor'
import LandingComparison from '@/components/landing/LandingComparison'
import LandingMigrationStrip from '@/components/landing/LandingMigrationStrip'
// import LandingMigration from '@/components/landing/LandingMigration' — parked on 2026-04-26. Replaced on the homepage by the compact LandingMigrationStrip; the long-form section is repurposable for a future /migration page. Component file kept intact.
// import LandingInventory from '@/components/landing/LandingInventory' — parked on 2026-04-26. Inventory is now covered by the Inventory tab in LandingProductDemo and the "Inventory & Memo" card in LandingPlatformModules. Component file kept intact.
import FAQSection, { type FAQItem } from '@/components/landing/FAQSection'
// LandingFAQ.tsx was deleted 2026-04-26 — its job is now done by the
// shared FAQSection component (renders identically on / and /pricing
// with different content passed as props). LandingFaq.legacy.tsx (lower
// case, the original pre-Phase-G version) is still on disk if needed.

const HOMEPAGE_FAQS: FAQItem[] = [
  {
    id: 'replace-pos',
    question: 'Can Nexpura replace my current POS?',
    answer:
      'Nexpura is designed to centralise jewellery retail workflows including POS, inventory, customers, repairs, bespoke orders, digital passports, and reporting. The best setup depends on your current tools and business needs.',
  },
  {
    id: 'repairs-bespoke',
    question: 'Does Nexpura support repairs and bespoke orders?',
    answer:
      'Yes. Nexpura includes repair tracking from intake to collection, plus bespoke workflows for quotes, approvals, deposits, sourcing, milestones, and production notes.',
  },
  {
    id: 'migration',
    question: 'Can I migrate my existing data?',
    answer:
      'Guided migration is available to help move key customer, inventory, repair, supplier, and business records into Nexpura.',
  },
  {
    id: 'free-trial',
    question: 'Is there a free trial?',
    answer:
      'Yes. You can start with a 14-day free trial and explore the core workflows before choosing a plan.',
  },
  {
    id: 'book-demo',
    question: 'Can I book a demo instead?',
    answer:
      'Yes. A guided walkthrough can help map Nexpura to your current POS, repair, bespoke, inventory, and customer workflows.',
  },
]
// LandingFinalCTA reactivated 2026-04-28 (Batch 2). Kaitlyn's spec
// asked for an explicit closing CTA block with new heading + footnote
// copy. The component itself was updated; we just import + render it.
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
        {/* <LandingDemoExplainer /> — parked on 2026-04-26. Kaitlyn's final order omits this section. Component file kept intact for repurposing. */}
        {/* LandingScreenshots removed 2026-04-26 — content moved into LandingProductDemo above and repositioned after the problem section. */}
        <LandingDigitalPassport />
        <LandingWhoItsFor />
        <LandingComparison />
        {/* <LandingInventory /> — parked on 2026-04-26. Inventory is already covered by the Inventory tab in Product Demo and the "Inventory & Memo" card in Platform Modules. Removing the standalone section to avoid triple-coverage and keep the homepage tight. */}
        {/* <LandingMigration /> — parked on 2026-04-26. Long-form migration content moved to a tighter 3-step LandingMigrationStrip below; the original component is the foundation for a future /migration page. */}
        <LandingMigrationStrip />
        <FAQSection
          heading="Questions jewellers ask before switching"
          subheading="Clear answers about trial, migration, POS, repairs, and setup."
          faqs={HOMEPAGE_FAQS}
          trailingNote={
            <p className="font-sans text-[0.95rem] text-m-text-secondary">
              More questions about migration, pricing, or specific features?{' '}
              <Link
                href="/contact"
                className="text-m-charcoal border-b border-m-charcoal pb-0.5 hover:opacity-70 transition-opacity"
              >
                Talk to the team
              </Link>
              .
            </p>
          }
        />
        <LandingFinalCTA />
      </main>
      <LandingFooter />
      <MarketingReveal />
    </div>
  )
}
