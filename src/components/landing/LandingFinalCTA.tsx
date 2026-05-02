// ============================================
// Final CTA — Batch 2 copy lock from Kaitlyn 2026-04-28.
// Heading + footnote text fixed by spec; layout / tokens unchanged.
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
          Start running your jewellery business from one connected platform.
        </h2>

        {/* CTA row */}
        <div className="mt-8 md:mt-9 flex flex-wrap justify-center gap-3 md:gap-4">
          <Link href="/signup" className={BUTTON.primary}>
            Start Free Trial
          </Link>

          <Link href="/contact?intent=demo" className={BUTTON.secondary}>
            Book a Guided Demo
          </Link>
        </div>

        {/* Small trust line — exact copy per Batch 2 spec */}
        <p className="mt-6 font-sans text-[0.88rem] text-[#8A8276]">
          14-day free trial <span aria-hidden="true" className="text-[#B9B0A1]">·</span> No charge today <span aria-hidden="true" className="text-[#B9B0A1]">·</span> Cancel anytime before your trial ends
        </p>
      </div>
    </section>
  )
}
