// ============================================
// Five-column footer with link groups.
// Per Kaitlyn 2026-04-26 brief — replaces the prior charcoal/social-row
// footer. Spec was missing the opening <a tags everywhere — restored.
// Internal-nav links use next/link (lint rule + SPA navigation).
// Routes that don't exist yet are flagged hidden:true so we don't ship
// dead links — the component filters them out before rendering, and an
// entire column will be hidden if all of its links are hidden.
//
// Route audit (2026-04-26 against src/app/**):
//   Product:    /platform, /features, /pricing, /security  → all live
//   Solutions:  /solutions/{retail,repairs,bespoke,multi-store}
//                                                         → all MISSING (hidden:true)
//   Platform:   /platform/{pos,inventory,repairs,passports,analytics,ai-copilot}
//                                                         → all MISSING (hidden:true)
//   Company:    /about, /contact, /demo, /signup           → all live
//   Legal:      /terms, /privacy                           → all live
// Solutions + Platform-detail columns currently render as empty (filtered)
// — flag to Kaitlyn that 8 placeholder pages need to be built before
// those columns repopulate.
// ============================================

import React from "react"
import Link from "next/link"

type FooterLink = {
  label: string
  href: string
  // If true, the link is hidden until the destination page exists.
  // Filtered out before render — never shipped as a dead link.
  hidden?: boolean
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
    heading: "Solutions",
    links: [
      { label: "Retail Jewellers", href: "/solutions/retail", hidden: true },
      { label: "Repairs & Workshops", href: "/solutions/repairs", hidden: true },
      { label: "Bespoke Studios", href: "/solutions/bespoke", hidden: true },
      { label: "Multi-Store Groups", href: "/solutions/multi-store", hidden: true },
    ],
  },
  {
    heading: "Platform",
    links: [
      { label: "POS", href: "/platform/pos", hidden: true },
      { label: "Inventory", href: "/platform/inventory", hidden: true },
      { label: "Repairs", href: "/platform/repairs", hidden: true },
      { label: "Digital Passports", href: "/platform/passports", hidden: true },
      { label: "Analytics", href: "/platform/analytics", hidden: true },
      { label: "AI Copilot", href: "/platform/ai-copilot", hidden: true },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Book a Demo", href: "/demo" },
      { label: "Start Free Trial", href: "/signup" },
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

export default function LandingFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className="bg-m-ivory border-t border-[#E4DBC9] px-6 pt-16 pb-10 md:pt-20 md:pb-12"
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl">
        {/* Top row: brand + columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-10 md:gap-8">

          {/* Brand block — spans 2 cols on desktop */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link
              href="/"
              className="font-serif text-m-charcoal text-[1.4rem] tracking-[0.18em] inline-block"
              aria-label="NEXPURA — home"
            >
              NEXPURA
            </Link>
            <p className="mt-4 font-sans text-[0.88rem] leading-[1.6] text-m-text-secondary max-w-[220px]">
              The operating system for modern jewellers.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => {
            const visibleLinks = col.links.filter((l) => !l.hidden)
            if (visibleLinks.length === 0) return null

            return (
              <nav key={col.heading} aria-label={col.heading}>
                <h3 className="font-sans text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#8A8276] mb-4">
                  {col.heading}
                </h3>
                <ul role="list" className="space-y-3">
                  {visibleLinks.map((link) => (
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
            )
          })}
        </div>

        {/* Bottom row: copyright */}
        <div className="mt-16 md:mt-20 pt-8 border-t border-[#E4DBC9] flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center justify-between">
          <p className="font-sans text-[0.85rem] text-[#8A8276]">
            © {currentYear} Nexpura. All rights reserved.
          </p>
          <p className="font-sans text-[0.85rem] text-[#8A8276]">
            Built for jewellers.
          </p>
        </div>
      </div>
    </footer>
  )
}
