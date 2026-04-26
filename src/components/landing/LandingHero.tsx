/**
 * Marketing hero — Kaitlyn 2026-04-26 redesign.
 *
 * Replaces the previous hero (and its right-column video + scroll cue)
 * with the centred, single-column layout from Kaitlyn's followup spec.
 * The single-line trust row at the bottom of this hero subsumes the
 * old four-column LandingTrustStrip, which has been removed from
 * src/app/page.tsx in the same change.
 *
 * Class names + copy are verbatim from Kaitlyn's brief; styles live in
 * src/app/globals.css under the "NEXPURA · MARKETING HERO" section.
 */
export default function LandingHero() {
  return (
    <section className="nx-hero">
      <div className="nx-hero__inner">

        <h1 className="nx-hero__headline">
          The Operating System for Modern Jewellers
        </h1>

        <p className="nx-hero__subhead">
          Run POS, repairs, bespoke orders, inventory, customer records,
          digital passports, and performance insights from one
          jewellery-specific platform.
        </p>

        <div className="nx-hero__ctas">
          <a href="/signup" className="nx-btn nx-btn--primary">
            Start Free Trial
          </a>
          <a href="#explore-platform" className="nx-btn nx-btn--secondary">
            Explore Platform
          </a>
        </div>

        <p className="nx-hero__trust">
          <span>14-day free trial</span>
          <span className="nx-dot" aria-hidden="true">·</span>
          <span>Guided migration available</span>
          <span className="nx-dot" aria-hidden="true">·</span>
          <span>Built for jewellery workflows</span>
          <span className="nx-dot" aria-hidden="true">·</span>
          <span>No hidden fees</span>
        </p>

      </div>
    </section>
  )
}
