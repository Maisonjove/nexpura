// ============================================
// "Run your jewellery business from one connected system"
// Per Kaitlyn 2026-04-26 brief — replaces the prior LandingCta
// (kept on disk for repurposing). Spec was missing the opening
// <a tags on both CTA buttons — restored.
// ============================================

import React from "react"
import Link from "next/link"

export default function LandingFinalCTA() {
  return (
    <section
      id="final-cta"
      className="bg-m-ivory px-6 py-20 md:py-24 lg:py-28"
      aria-labelledby="final-cta-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2
          id="final-cta-heading"
          className="font-serif text-m-charcoal text-[2rem] leading-[1.12] tracking-[-0.005em] md:text-[2.6rem]"
        >
          Run your jewellery business from one connected system
        </h2>

        <p className="mt-5 text-m-text-secondary text-[1.05rem] md:text-[1.15rem] leading-[1.55] max-w-[620px] mx-auto">
          Start with a free trial or book a walkthrough tailored to your
          current workflows.
        </p>

        {/* CTA row */}
        <div className="mt-8 md:mt-9 flex flex-wrap justify-center gap-3 md:gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-[#111] text-white border border-[#111] px-7 py-3.5 font-sans text-[0.95rem] font-medium transition-all duration-200 hover:bg-[#2a2a2a] hover:-translate-y-0.5"
          >
            Start Free Trial
          </Link>

          <Link
            href="/demo"
            className="inline-flex items-center justify-center rounded-full bg-transparent text-m-charcoal border border-m-charcoal px-7 py-3.5 font-sans text-[0.95rem] font-medium transition-all duration-200 hover:bg-m-charcoal hover:text-white hover:-translate-y-0.5"
          >
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
