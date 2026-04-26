'use client'

// ============================================
// "See Nexpura in action" — main product proof section
// Per Kaitlyn 2026-04-26 brief. Verbatim from spec except:
//  - "use client" added (uses useState + onClick)
//  - opening <a tag added on the "View feature" link (typo in spec)
//  - image paths repointed at the existing /screenshots/* assets
//    (per project; CRM falls back to dashboard.png until a dedicated
//    CRM screenshot ships, mirroring the previous LandingScreenshots
//    component's fallback)
//  - inline <style> keyframe moved to globals.css to avoid the
//    style-tag-in-component hydration warning
// ============================================

import { useState } from "react"
import { SECTION_PADDING, HEADING, INTRO_SPACING, INLINE_LINK, CONTAINER } from "./_tokens"

type TabKey = "repairs" | "inventory" | "bespoke" | "passport" | "analytics" | "crm"

type Tab = {
  key: TabKey
  label: string
  title: string
  paragraph: string
  bullets: string[]
  href: string
  image: { src: string; alt: string }
}

const TABS: Tab[] = [
  {
    key: "repairs",
    label: "Repairs",
    title: "Repair Tracker",
    paragraph:
      "Track every repair from intake to collection with customer details, item photos, pricing, due dates, staff assignment, deposits, balances, and collection readiness.",
    bullets: [
      "Log item details, photos, quotes, and due dates",
      "Assign work to staff or workshop queues",
      "Track status, balance, and collection readiness",
    ],
    href: "/platform/repairs",
    image: { src: "/screenshots/repairs.png", alt: "Nexpura Repair Tracker — repair detail view with customer, item, financial summary, and stage timeline" },
  },
  {
    key: "inventory",
    label: "Inventory",
    title: "Inventory Intelligence",
    paragraph:
      "See every piece, stone, metal, component, reservation, memo status, location, and movement history in one live inventory view.",
    bullets: [
      "Track in stock, reserved, low stock, and on memo items",
      "View location, cost, provenance, and movement history",
      "Filter stock by status, location, category, or availability",
    ],
    href: "/platform/inventory",
    image: { src: "/screenshots/inventory.png", alt: "Nexpura Inventory Intelligence — live stock view with status, location, and provenance" },
  },
  {
    key: "bespoke",
    label: "Bespoke",
    title: "Bespoke Orders",
    paragraph:
      "Manage custom jobs from enquiry to approval, sourcing, production, deposits, milestones, and final handover.",
    bullets: [
      "Keep sketches, quotes, stones, and notes together",
      "Track approvals, deposits, and production stages",
      "Connect every bespoke job to the customer record",
    ],
    href: "/platform/bespoke",
    image: { src: "/screenshots/bespoke.png", alt: "Nexpura Bespoke Orders — custom job pipeline with sketches, approvals, and production stages" },
  },
  {
    key: "passport",
    label: "Passport",
    title: "Digital Passport",
    paragraph:
      "Attach a QR-verifiable record to each eligible piece, including materials, provenance, craftsmanship, service history, and aftercare information.",
    bullets: [
      "Give customers instant verification",
      "Preserve materials and provenance details",
      "Build trust beyond the point of sale",
    ],
    href: "/platform/passport",
    image: { src: "/screenshots/passport.png", alt: "Nexpura Digital Passport — QR-verifiable record with materials, provenance, and service history" },
  },
  {
    key: "analytics",
    label: "Analytics",
    title: "Performance Insights",
    paragraph:
      "Track sales, repairs, stock movement, team activity, and business performance through clear dashboards built for jewellery operations.",
    bullets: [
      "Monitor sales and workflow performance",
      "Identify overdue jobs and slow-moving stock",
      "View trends across locations and teams",
    ],
    href: "/platform/analytics",
    image: { src: "/screenshots/analytics.png", alt: "Nexpura Performance Insights — dashboard with sales, repairs, and stock movement trends" },
  },
  {
    key: "crm",
    label: "CRM",
    // Falls back to /screenshots/dashboard.png until a dedicated CRM
    // screenshot lands — mirrors the prior LandingScreenshots fallback.
    title: "Customer Profiles",
    paragraph:
      "Keep purchase history, repair records, bespoke notes, preferences, digital passports, and communication history connected to each customer.",
    bullets: [
      "View full customer history in one place",
      "Connect purchases, repairs, and bespoke jobs",
      "Prepare better follow-ups and appointments",
    ],
    href: "/platform/crm",
    image: { src: "/screenshots/dashboard.png", alt: "Nexpura Customer Profiles — unified customer history with purchases, repairs, and bespoke jobs" },
  },
]

export default function LandingProductDemo() {
  const [active, setActive] = useState<TabKey>("repairs")
  const current = TABS.find((t) => t.key === active)!

  return (
    <section
      id="product-demo"
      className={`bg-m-ivory ${SECTION_PADDING.flagship}`}
      aria-labelledby="product-demo-heading"
    >
      <div className={CONTAINER.wide}>
        {/* Intro */}
        <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
          <h2
            id="product-demo-heading"
            className={HEADING.h2}
          >
            See Nexpura in action
          </h2>
          <p className={`${HEADING.subhead} max-w-[680px] mx-auto`}>
            A closer look at the daily screens your team uses to manage repairs,
            stock, bespoke jobs, customers, passports, and performance.
          </p>
        </div>

        {/* Tab strip */}
        <div
          role="tablist"
          aria-label="Product features"
          className="flex flex-wrap justify-center gap-2 md:gap-3 mb-10 md:mb-12"
        >
          {TABS.map((t) => {
            const isActive = t.key === active
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${t.key}`}
                id={`tab-${t.key}`}
                onClick={() => setActive(t.key)}
                className={`
                  rounded-full px-5 py-2.5 text-[0.95rem] font-medium
                  transition-all duration-200
                  ${
                    isActive
                      ? "bg-[#111] text-white border border-[#111]"
                      : "bg-[#F1E9D8] text-m-charcoal border border-[#E4DBC9] hover:border-[#C9BFA9]"
                  }
                `}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Active panel */}
        <div
          role="tabpanel"
          id={`panel-${current.key}`}
          aria-labelledby={`tab-${current.key}`}
          key={current.key}
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10 lg:gap-14 items-center animate-[nxFadeInTab_400ms_ease-out]"
        >
          {/* Product image — large, prominent */}
          <div className="order-1 lg:order-1">
            <div className="relative rounded-2xl overflow-hidden bg-white border border-[#E4DBC9] shadow-[0_20px_60px_-20px_rgba(60,40,20,0.18)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={current.image.src}
                alt={current.image.alt}
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>
          </div>

          {/* Copy block */}
          <div className="order-2 lg:order-2">
            <h3 className="font-serif text-m-charcoal text-[1.6rem] md:text-[1.85rem] leading-[1.2] mb-4">
              {current.title}
            </h3>
            <p className="text-m-text-secondary text-[1rem] leading-[1.6] mb-6">
              {current.paragraph}
            </p>

            <ul role="list" className="space-y-3 mb-8">
              {current.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-m-charcoal text-[0.97rem] leading-[1.55]">
                  <span
                    aria-hidden="true"
                    className="mt-2 inline-block w-1.5 h-1.5 rounded-full bg-[#C9A24A] flex-shrink-0"
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <a
              href={current.href}
              className={`group ${INLINE_LINK}`}
            >
              View feature
              <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
