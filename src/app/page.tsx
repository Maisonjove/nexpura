// Landing page - no auth check needed
import LandingHeader from '@/components/landing/LandingHeader'
import LandingHero from '@/components/landing/LandingHero'
import LandingLogoBar from '@/components/landing/LandingLogoBar'
import LandingFeatures from '@/components/landing/LandingFeatures'
import LandingShowcase from '@/components/landing/LandingShowcase'
import LandingDifferentiators from '@/components/landing/LandingDifferentiators'
import LandingInventory from '@/components/landing/LandingInventory'
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
        <LandingFeatures />
        <LandingShowcase />
        <LandingDifferentiators />
        <LandingInventory />
        <LandingTestimonial />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  )
}
