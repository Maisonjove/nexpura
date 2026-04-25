'use client'

import Button from './ui/Button'

/**
 * Marketing hero per Kaitlyn's brief (section 5).
 *
 * Copy updates:
 *  - Headline: keep "The Operating System for Modern Jewellers"
 *  - Subheading: replaced with the jewellery-specific list
 *  - Primary CTA: Start Free Trial (was: Book a Demo)
 *  - Secondary CTA: See the Platform
 *  - New microcopy line under the CTA row
 *  - New scroll cue centred below the hero content
 *
 * Hero media (right column) is left untouched per the brief's
 * non-negotiable constraint — the existing /video.mp4 element stays
 * exactly where it was in source, container size, and aspect ratio.
 */
export default function LandingHero() {
  return (
    <section className="relative grid grid-cols-1 lg:grid-cols-2 min-h-0 pt-16 sm:pt-20 lg:pt-[72px] pb-16 lg:pb-0 lg:min-h-[calc(100vh-72px)] bg-m-ivory">
      {/* Content column */}
      <div className="flex flex-col justify-center px-6 sm:px-10 lg:pl-24 lg:pr-12 text-center lg:text-left pb-12 lg:pb-0 max-w-[640px] lg:max-w-[560px] mx-auto lg:mx-0">
        <h1
          style={{ animationDelay: '0.1s' }}
          className="nx-fade-in-blur font-serif text-4xl sm:text-5xl lg:text-[clamp(2.5rem,4.5vw,4.25rem)] font-normal leading-[1.15] tracking-[-0.01em] text-m-charcoal"
        >
          The Operating System for Modern Jewellers
        </h1>
        <p
          style={{ animationDelay: '0.25s' }}
          className="nx-fade-in-blur text-[16px] sm:text-[17px] leading-[1.6] text-m-text-secondary max-w-[520px] mt-6 mx-auto lg:mx-0"
        >
          Run repairs, inventory, bespoke orders, sales, digital passports, and customer records from one jewellery-specific platform.
        </p>

        <div
          style={{ animationDelay: '0.4s' }}
          className="nx-fade-in-blur-up flex items-center flex-wrap gap-3 self-center lg:self-start mt-8"
        >
          <Button href="/signup" size="lg">
            Start Free Trial
          </Button>
          <Button href="/platform" variant="secondary" size="lg">
            See the Platform
          </Button>
        </div>

        <p
          style={{ animationDelay: '0.55s' }}
          className="nx-fade-in-blur text-[13px] font-sans tracking-[0.05em] text-m-text-muted mt-4 self-center lg:self-start"
        >
          14-day free trial · Guided migration available · No hidden fees
        </p>
      </div>

      {/* Media column — UNTOUCHED per brief's non-negotiable constraint.
          Keeps existing /video.mp4 exactly as it was in source. */}
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

      {/* Scroll cue — centred below the hero content (desktop only — on
          mobile the hero is short enough that a cue is redundant). */}
      <a
        href="#audience"
        aria-label="Explore the platform"
        className="hidden lg:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-1.5 text-m-text-muted text-[12px] font-sans tracking-[0.15em] uppercase nx-bounce-y motion-reduce:animate-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne rounded"
      >
        <span>Explore the platform</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </a>
    </section>
  )
}
