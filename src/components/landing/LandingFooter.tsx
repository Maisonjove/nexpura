// ============================================
// Four-column marketing footer.
// 2026-04-28 (Batch 1 site refinement): refactored from the prior
// five-column layout (which filtered two empty columns, Solutions +
// Platform-detail). New layout — verbatim from Kaitlyn's spec —
// surfaces Verify Passport in its own "For Customers" column so it
// doesn't compete with the buyer CTAs in Company.
//
// Columns:
//   Product:        Platform · Features · Pricing · Security
//   Company:        About · Contact · Book a Guided Demo · Start Free Trial
//   For Customers:  Verify Passport
//   Legal:          Terms · Privacy
//
// Note on the copyright year: under Next 16's cacheComponents mode,
// `new Date()` in either a server OR client component bails out the
// static prerender. We hardcode the year here. Update at the start of
// each calendar year.
// ============================================

import React from "react"
import Link from "next/link"

type FooterLink = {
  label: string
  href: string
}

type FooterColumn = {
  heading: string
  links: FooterLink[]
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "Platform", href: "/platform" },
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Security", href: "/security" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Book a Guided Demo", href: "/contact" },
      { label: "Start Free Trial", href: "/signup" },
    ],
  },
  {
    heading: "For Customers",
    links: [
      { label: "Verify Passport", href: "/verify" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
]

const COPYRIGHT_YEAR = 2026

export default function LandingFooter() {
  return (
    <footer
      className="bg-m-ivory border-t border-[#E4DBC9] px-6 pt-16 pb-10 md:pt-20 md:pb-12"
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl">
        {/* Top row: brand + 4 link columns
            Desktop: 5-col grid (1 brand + 4 link cols).
            Tablet:  3 cols, brand spans 3.
            Mobile:  2 cols, brand spans 2. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-10 md:gap-8">

          {/* Brand block */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link
              href="/"
              className="font-serif text-m-charcoal text-[1.4rem] tracking-[0.18em] inline-block transition-opacity duration-200 hover:opacity-70"
              aria-label="NEXPURA — home"
            >
              NEXPURA
            </Link>
            <p className="mt-4 font-sans text-[0.88rem] leading-[1.6] text-m-text-secondary max-w-[220px]">
              The operating system for modern jewellers.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 className="font-sans text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#8A8276] mb-4">
                {col.heading}
              </h3>
              <ul role="list" className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-sans text-[0.92rem] text-m-charcoal transition-opacity duration-200 hover:opacity-65"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom row: copyright */}
        <div className="mt-16 md:mt-20 pt-8 border-t border-[#E4DBC9] flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center justify-between">
          <p className="font-sans text-[0.85rem] text-[#8A8276]">
            © {COPYRIGHT_YEAR} Nexpura. All rights reserved.
          </p>
          <p className="font-sans text-[0.85rem] text-[#8A8276]">
            Built for jewellers.
          </p>
        </div>
      </div>
    </footer>
  )
}
