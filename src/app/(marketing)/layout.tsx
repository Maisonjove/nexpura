import LandingHeader from '@/components/landing/LandingHeader'
import LandingFooter from '@/components/landing/LandingFooter'
import ScrollToTop from '@/components/landing/ScrollToTop'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ScrollToTop />
      <LandingHeader />
      <main className="flex-1 page-shell">{children}</main>
      <LandingFooter />
    </div>
  );
}
