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
          Run your jewellery business from one connected system
        </h2>

        <p className={`${HEADING.subhead} max-w-[620px] mx-auto`}>
          Start with a free trial or book a walkthrough tailored to your
          current workflows.
        </p>

        {/* CTA row */}
        <div className="mt-8 md:mt-9 flex flex-wrap justify-center gap-3 md:gap-4">
          <Link href="/signup" className={BUTTON.primary}>
            Start Free Trial
          </Link>

          <Link href="/demo" className={BUTTON.secondary}>
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
