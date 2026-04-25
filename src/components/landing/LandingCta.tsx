import Button from './ui/Button'

/**
 * Final CTA per Kaitlyn's brief (section 18). Full-width charcoal
 * background, centered content. "Start Free Trial" primary, "Book a
 * Demo" secondary. Subtle champagne radial behind heading.
 */
export default function LandingCta() {
  return (
    <section className="relative bg-m-charcoal text-white py-24 lg:py-32 px-6 sm:px-12 overflow-hidden">
      {/* Subtle champagne radial behind heading (10% opacity) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.10]"
        style={{
          background:
            'radial-gradient(ellipse at top, rgba(201,169,97,1) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-[720px] mx-auto text-center m-reveal">
        <h2 className="font-serif text-[32px] sm:text-[40px] lg:text-[44px] leading-[1.15] text-white">
          Start running your jewellery business on Nexpura
        </h2>
        <p className="mt-6 text-[16px] sm:text-[18px] leading-[1.6] text-white/70">
          Try the platform free, explore the workflows, and book a guided walkthrough when you are ready.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            href="/signup"
            size="lg"
            className="!bg-white !text-m-charcoal hover:!bg-white/90"
          >
            Start Free Trial
          </Button>
          <Button
            href="/contact"
            size="lg"
            className="!bg-transparent !text-white border border-white hover:!bg-white/10"
          >
            Book a Demo
          </Button>
        </div>

        <p className="mt-5 text-[13px] font-sans tracking-[0.05em] text-white/50">
          14-day free trial · Guided setup available · Migration support included
        </p>
      </div>
    </section>
  )
}
