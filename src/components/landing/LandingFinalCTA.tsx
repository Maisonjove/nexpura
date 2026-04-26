// ============================================
// "Run your jewellery business from one connected system"
// Per Kaitlyn 2026-04-26 brief — replaces the prior LandingCta
// (kept on disk for repurposing). Spec was missing the opening
// <a tags on both CTA buttons — restored.
// ============================================

import React from "react"
import Link from "next/link"
import { SECTION_PADDING, HEADING, BUTTON, CONTAINER } from "./_tokens"

export default function LandingFinalCTA() {
  return (
    <section
      id="final-cta"
      className={`bg-m-ivory ${SECTION_PADDING.standard}`}
      aria-labelledby="final-cta-heading"
    >
      <div className={`${CONTAINER.narrow} text-center`}>
        <h2
          id="final-cta-heading"
          className={HEADING.h2Closing}
        >
          See how Nexpura fits your jewellery business
        </h2>

        <p className={`${HEADING.subhead} max-w-[640px] mx-auto`}>
          Start free or book a personalised walkthrough built around your
          current POS, repair, bespoke, inventory, and customer workflows.
        </p>

        {/* CTA row */}
        <div className="mt-8 md:mt-9 flex flex-wrap justify-center gap-3 md:gap-4">
          <Link href="/signup" className={BUTTON.primary}>
            Start Free Trial
          </Link>

          <Link href="/contact" className={BUTTON.secondary}>
            Book a Demo
          </Link>
        </div>

        {/* Small trust line */}
        <p className="mt-6 font-sans text-[0.88rem] text-[#8A8276]">
          14-day free trial <span aria-hidden="true" className="text-[#B9B0A1]">·</span> Guided setup available
        </p>
      </div>
    </section>
  )
}
