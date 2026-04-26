/**
 * Marketing "Explore the Platform" intro section — Kaitlyn 2026-04-26.
 *
 * Sits directly below the new hero and serves as the scroll target for
 * the hero's secondary CTA (`#explore-platform`). Replaces the bare
 * `<hr>` + anchor div placeholder that landed in the previous commit
 * on this branch.
 *
 * Class names + copy are verbatim from Kaitlyn's brief; styles live in
 * src/app/globals.css under the "NEXPURA · EXPLORE-PLATFORM SECTION"
 * section. The heading's font-family is chained through
 * `--font-playfair` to match how the hero rule was authored.
 */
export default function LandingExplorePlatform() {
  return (
    <section id="explore-platform" className="nx-explore">
      <div className="nx-explore__rule" aria-hidden="true"></div>

      <div className="nx-explore__inner">
        <span className="nx-explore__eyebrow">Explore the Platform</span>
        <h2 className="nx-explore__heading">
          Every part of your jewellery business, in one place.
        </h2>
        <p className="nx-explore__lede">
          From the front counter to the workshop bench — see how NEXPURA
          replaces the patchwork of tools modern jewellers outgrow.
        </p>
      </div>
    </section>
  )
}
