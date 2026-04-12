// Landing page - no auth check needed
import LandingHeader from '@/components/landing/LandingHeader'
import LandingHero from '@/components/landing/LandingHero'
import LandingLogoBar from '@/components/landing/LandingLogoBar'
import LandingWhoItsFor from '@/components/landing/LandingWhoItsFor'
import LandingFeatures from '@/components/landing/LandingFeatures'
import LandingPainPoints from '@/components/landing/LandingPainPoints'
import LandingRepairs from '@/components/landing/LandingRepairs'
import LandingShowcase from '@/components/landing/LandingShowcase'
import LandingPlatformModules from '@/components/landing/LandingPlatformModules'
import LandingScreenshots from '@/components/landing/LandingScreenshots'
import LandingDifferentiators from '@/components/landing/LandingDifferentiators'
import LandingMigration from '@/components/landing/LandingMigration'
import LandingDigitalPassports from '@/components/landing/LandingDigitalPassports'
import LandingInventory from '@/components/landing/LandingInventory'
import LandingComparison from '@/components/landing/LandingComparison'
import LandingTestimonialsExpanded from '@/components/landing/LandingTestimonialsExpanded'
import LandingDemoExplainer from '@/components/landing/LandingDemoExplainer'
import LandingFaq from '@/components/landing/LandingFaq'
import LandingTestimonial from '@/components/landing/LandingTestimonial'
import LandingCta from '@/components/landing/LandingCta'
import LandingFooter from '@/components/landing/LandingFooter'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero />
        <LandingLogoBar />
        <LandingWhoItsFor />
        <LandingFeatures />
        <LandingPainPoints />
        <LandingRepairs />
        <LandingShowcase />
        <LandingPlatformModules />
        <LandingScreenshots />
        <LandingDifferentiators />
        <LandingMigration />
        <LandingDigitalPassports />
        <LandingInventory />
        <LandingComparison />
        <LandingTestimonialsExpanded />
        <LandingDemoExplainer />
        <LandingFaq />
        <LandingTestimonial />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  )
}
