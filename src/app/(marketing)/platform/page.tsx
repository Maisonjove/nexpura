import LandingPlatformModules from '@/components/landing/LandingPlatformModules'
import LandingScreenshots from '@/components/landing/LandingScreenshots'
import LandingDemoExplainer from '@/components/landing/LandingDemoExplainer'
import Link from 'next/link'

export const metadata = {
  title: 'Platform — Nexpura',
  description:
    'The complete operating system for jewellery businesses. POS, inventory, repairs, bespoke orders, CRM, invoicing, analytics, digital passports, and AI — all connected.',
}

export default function PlatformPage() {
  return (
    <div className="pt-[72px]">
      {/* Page hero */}
      <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-[clamp(2.5rem,5vw,4.5rem)] font-normal leading-[1.08] tracking-[-0.01em] text-stone-900 mb-6">
          The Nexpura Platform
        </h1>
        <p className="text-stone-500 text-[0.9375rem] leading-relaxed max-w-2xl mx-auto mb-10">
          A complete operating system for jewellery businesses. POS, inventory, repairs, bespoke orders,
          CRM, invoicing, analytics, digital passports, memo &amp; consignment, and AI — connected.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center justify-center min-w-[180px] px-10 py-4 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] relative overflow-hidden transition-shadow duration-400"
        >
          <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
          <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">Book a Demo</span>
        </Link>
      </section>
      <LandingPlatformModules />
      <LandingScreenshots />
      <LandingDemoExplainer />
    </div>
  )
}
