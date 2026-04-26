import Link from 'next/link'

/**
 * Marketing hero — Kaitlyn 2026-04-26 redesign (revision: video restored).
 *
 * Two-column hero: text + CTAs on the left (centred on mobile, left-aligned
 * on lg+), the long-standing /video.mp4 on the right. The original layout
 * structure is recovered from main:src/components/landing/LandingHero.tsx
 * (commit 6835e22). Copy, CTAs, and the four-item trust row are verbatim
 * from Kaitlyn's 2026-04-26 brief.
 *
 * Typography decisions kept from Kaitlyn's brief:
 *  - Headline uses the site serif (font-serif → --font-instrument-serif)
 *    at clamp(2.25rem, 5.2vw, 3.75rem), weight 500.
 *  - Pill CTAs (rounded-full) — primary filled charcoal, secondary outline.
 *  - Trust row uses dot separators (·) and Inter at 0.9rem.
 *
 * The previous commit's bottom scroll-cue button is intentionally dropped:
 * the new "Explore Platform" CTA + #explore-platform anchor on
 * LandingExplorePlatform serves the same purpose.
 */
export default function LandingHero() {
  return (
    <section className="relative grid grid-cols-1 lg:grid-cols-2 min-h-0 pt-16 sm:pt-20 lg:pt-[72px] pb-16 lg:pb-0 lg:min-h-[calc(100vh-72px)] bg-m-ivory">
      {/* Content column */}
      <div className="flex flex-col justify-center px-6 sm:px-10 lg:pl-24 lg:pr-12 text-center lg:text-left pb-12 lg:pb-0 max-w-[640px] lg:max-w-[560px] mx-auto lg:mx-0">
        <h1 className="font-serif font-medium text-m-charcoal text-[clamp(2.25rem,5.2vw,3.75rem)] leading-[1.08] tracking-[-0.01em]">
          The Operating System for Modern Jewellers
        </h1>

        <p className="mt-5 text-[clamp(1.05rem,1.4vw,1.2rem)] leading-[1.55] text-m-text-secondary max-w-[520px] mx-auto lg:mx-0">
          Run POS, repairs, bespoke orders, inventory, customer records,
          digital passports, and performance insights from one
          jewellery-specific platform.
        </p>

        <div className="mt-8 flex items-center flex-wrap gap-4 justify-center lg:justify-start">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-9 py-4 rounded-full bg-m-charcoal text-white text-[1rem] font-medium tracking-[0.01em] border border-m-charcoal transition-[transform,background] duration-200 hover:bg-m-charcoal-soft hover:-translate-y-px"
          >
            Start Free Trial
          </Link>
          <a
            href="#explore-platform"
            className="inline-flex items-center justify-center px-9 py-4 rounded-full bg-transparent text-m-charcoal text-[1rem] font-medium tracking-[0.01em] border border-m-charcoal transition-[transform,background,color] duration-200 hover:bg-m-charcoal hover:text-white hover:-translate-y-px"
          >
            Explore Platform
          </a>
        </div>

        <p className="mt-5 flex flex-wrap gap-x-2.5 gap-y-1 justify-center lg:justify-start text-[0.9rem] leading-[1.5] text-m-text-muted max-w-[760px] mx-auto lg:mx-0">
          <span>14-day free trial</span>
          <span className="text-m-text-faint" aria-hidden="true">·</span>
          <span>Guided migration available</span>
          <span className="text-m-text-faint" aria-hidden="true">·</span>
          <span>Built for jewellery workflows</span>
          <span className="text-m-text-faint" aria-hidden="true">·</span>
          <span>No hidden fees</span>
        </p>
      </div>

      {/* Media column — preserved from the original hero (main commit
          6835e22). Same /video.mp4, same aspect-ratio container, same
          object-cover fill, same mobile rounding. */}
      <div className="relative w-full mx-auto px-6 lg:px-0 aspect-[4/3] lg:aspect-auto">
        <video
          className="absolute inset-0 w-full h-full object-cover rounded-2xl lg:rounded-none"
          autoPlay
          muted
          loop
          playsInline
        >
          <source src="/video.mp4" type="video/mp4" />
        </video>
      </div>
    </section>
  )
}
