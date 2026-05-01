'use client'

// ============================================
// Features — full content page for all 9 modules.
// Rebuilt 2026-04-28 (Batch 1 site refinement).
//
// Replaces the prior tab-based layout where only the active panel was
// in the DOM (Kaitlyn flagged: only POS had real content; the other
// 8 modules' content was either thin or hidden behind tabs that
// didn't render their panels into the DOM until clicked, which broke
// indexability + accessibility).
//
// New layout:
//   - Hero (page intro)
//   - Sticky in-page module index (anchor nav, premium understated)
//   - 9 module sections, each rendered into the DOM at all times:
//       heading · 1-sentence intro · 4–5 feature bullets ·
//       practical jewellery use case · soft visual placeholder
//   - Final CTA (Start Free Trial · Book a Guided Demo)
//
// Visual system reuses the landing tokens (_tokens.ts) so the page
// feels native to the marketing surface.
// ============================================

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ShoppingBag,
  Wrench,
  Gem,
  Package,
  Users,
  FileText,
  Truck,
  LayoutGrid,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import {
  SECTION_PADDING,
  HEADING,
  CARD,
  BUTTON,
  CONTAINER,
} from '@/components/landing/_tokens'

const EASE = [0.22, 1, 0.36, 1] as const

const fadeBlur = {
  initial: { opacity: 0, filter: 'blur(6px)' },
  whileInView: { opacity: 1, filter: 'blur(0px)' },
  viewport: { once: true } as const,
  transition: { duration: 1.2, ease: EASE },
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, filter: 'blur(4px)', y: 16 },
  whileInView: { opacity: 1, filter: 'blur(0px)', y: 0 },
  viewport: { once: true } as const,
  transition: { duration: 1.2, ease: EASE, delay },
})

// ============================================
// Module content — 9 modules, full detail.
// ============================================
type Module = {
  id: string
  title: string
  icon: LucideIcon
  intro: string
  bullets: string[]
  useCase: string
  /**
   * Real screenshots ship for some modules; the rest fall back to a
   * styled placeholder. Kaitlyn will swap in real assets in Batch 2/3
   * once the design files are ready.
   */
  image?: string
  imageAlt?: string
}

const MODULES: Module[] = [
  {
    id: 'pos',
    title: 'Point of Sale',
    icon: ShoppingBag,
    image: '/mockups/modules/pos.svg',
    imageAlt: 'Point of Sale interface — cart panel with three line items and a serif total of $6,387',
    intro:
      'A jewellery POS that connects every sale to the customer record, the piece, and the post-sale service trail.',
    bullets: [
      'Fast SKU and barcode scanning with low-stock signals at the counter',
      'Multiple payment methods, split tender, layby, gift cards, and trade-ins',
      'Connect each sale to the customer profile and the item record automatically',
      'Real-time inventory deduction across stores and locations',
      'Receipts that include the piece details and any digital passport reference',
    ],
    useCase:
      'When a regular comes in for a stud-earring purchase, your team scans the SKU, picks the existing customer, and the sale is logged against their profile with the piece reference attached. No paper, no rekeying, and the new piece is ready for a digital passport if the customer wants one.',
  },
  {
    id: 'repairs',
    title: 'Repairs & Workshop',
    icon: Wrench,
    image: '/screenshots/repairs.png',
    imageAlt: 'Nexpura Repair Tracker — repair detail with customer, item, financial summary, and stage timeline',
    intro:
      'Track every repair from intake to collection with photos, deposits, balances, status, and overdue alerts.',
    bullets: [
      'Digital intake — photos, condition notes, deposit, due date in under a minute',
      'Workshop queue with assignment, status, and stage timestamps',
      'Customer notifications at each stage (ready, collected, follow-up)',
      'Deposit and balance tracking against each job',
      'Overdue alerts so jobs never slip past the due date silently',
    ],
    useCase:
      'When a customer drops in a ring for a resize, intake takes under a minute — photos, condition notes, deposit, and due date are captured and the workshop sees it instantly. When the job is ready, the customer is notified automatically and the balance shows up at the counter on collection.',
  },
  {
    id: 'bespoke',
    title: 'Bespoke Commissions',
    icon: Gem,
    image: '/screenshots/bespoke.png',
    imageAlt: 'Nexpura Bespoke Orders — custom job pipeline with sketches, approvals, and production stages',
    intro:
      'Run custom commissions with structured approvals, milestones, sourcing notes, and deposit gates from brief to delivery.',
    bullets: [
      'Brief, sketches, and reference images stored against the job',
      'Stage-gate approvals — design sign-off, casting, setting, finishing',
      'Milestone-based deposit schedule with running balance',
      'Sourcing notes for stones and metals, linked to the supplier record',
      'Production timeline visible to the team and shareable with the client',
    ],
    useCase:
      'When a client commissions a bespoke engagement ring, the design brief, stone selection, and milestone deposits are captured against one job. The workshop sees what stage the piece is at, the sales team sees the next deposit due, and the client gets a clean handover with full provenance built into the final passport.',
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: Package,
    image: '/screenshots/inventory.png',
    imageAlt: 'Nexpura Inventory Intelligence — live stock view with status, location, and provenance',
    intro:
      'Live stock for finished pieces, stones, metals, components, memo, and consignment — with full provenance and movement history.',
    bullets: [
      'Multi-category inventory: pieces, stones, metals, findings, components',
      'Filter by status — in stock, reserved, on memo, low stock, archived',
      'Multi-location stock visibility across stores and the workshop',
      'Reorder alerts before low stock affects sales',
      'Full movement history per item — receiving, transfers, sales, returns',
    ],
    useCase:
      'When a customer asks if a particular pendant is available in white gold, your team can see in seconds what is in stock at each store, what is on memo with another customer, and when the next reorder lands. No phone calls between stores, no guesswork.',
  },
  {
    id: 'customers',
    title: 'Customers / CRM',
    icon: Users,
    image: '/mockups/modules/customers.svg',
    imageAlt: 'Customer profile — Eleanor Whitfield VIP card with anniversary, ring size, lifetime spend, and recent purchase and service history',
    intro:
      'A jeweller-specific CRM that keeps purchase history, repairs, bespoke jobs, preferences, and reminders in one record.',
    bullets: [
      'Complete purchase, repair, and bespoke history in one profile',
      'VIP tags, preferences, partner names, ring sizes, and custom fields',
      'Birthday, anniversary, and follow-up reminders surfaced for the team',
      'Communication log — calls, emails, in-store conversations',
      'Pieces owned (with passport links) attached to the customer record',
    ],
    useCase:
      'When a longtime customer comes in, your team sees their preferred metal, ring size, partner anniversary, last three purchases, and an open repair from two months ago — all on one screen. The conversation starts where the last one left off, not from scratch.',
  },
  {
    id: 'invoicing',
    title: 'Invoicing',
    icon: FileText,
    image: '/mockups/modules/invoicing.svg',
    imageAlt: 'Invoice INV-2026-0218 — line items, deposit received, and a $2,300 balance due',
    intro:
      'Branded invoices, balance tracking, and payments connected directly to repairs, bespoke jobs, and sales.',
    bullets: [
      'Professional invoice templates with your branding',
      'Partial payment and running balance tracking on every invoice',
      'Outstanding balance dashboard for the whole business',
      'PDF generation and email delivery built in',
      'Invoices linked to the underlying repair, bespoke job, or sale',
    ],
    useCase:
      'When a bespoke client pays the second milestone deposit, the invoice updates, the balance moves, and the workshop is notified that production can proceed to the next stage. No spreadsheet, no manual reconciliation between accounting and operations.',
  },
  {
    id: 'suppliers',
    title: 'Suppliers',
    icon: Truck,
    image: '/mockups/modules/suppliers.svg',
    imageAlt: 'Supplier list — four suppliers with last-order date, on-time performance bar, and YTD spend',
    intro:
      'Supplier records, purchase orders, receiving, and reconciliation connected to inventory and bespoke sourcing.',
    bullets: [
      'Supplier directory with contact details, terms, and lead times',
      'Purchase order creation and tracking with line-item visibility',
      'Stock receiving with cost recording and provenance',
      'Supplier-linked inventory items for traceability',
      'Reconciliation against supplier invoices when stock arrives',
    ],
    useCase:
      'When a stone parcel arrives from your overseas supplier, receiving captures the cost, parcel reference, and individual stone IDs into inventory. Each stone now carries provenance, and any future bespoke job can pull it directly from the supplier record into the production brief.',
  },
  {
    id: 'command-center',
    title: 'Command Centers',
    icon: LayoutGrid,
    image: '/mockups/modules/command-centers.svg',
    imageAlt: 'Owner command centre dashboard — four metric cards covering overdue repairs, low stock, unpaid balances, and approvals waiting',
    intro:
      'Every repair and bespoke job gets its own operational screen with status, finances, photos, and activity history.',
    bullets: [
      'Full job context on one screen — customer, piece, status, finances',
      'Activity timeline of every action taken on the job',
      'Live financial summary — deposit, balance, payments received',
      'Linked photos, sketches, and documents inline',
      'Staff actions logged for accountability and handover',
    ],
    useCase:
      'When a customer rings to ask about their bespoke ring, anyone on the team can open the command centre, see the latest workshop photo, the balance owing, the next milestone, and the conversation log — and answer the call confidently without putting the customer on hold.',
  },
  {
    id: 'analytics',
    title: 'Analytics & Reporting',
    icon: BarChart3,
    image: '/screenshots/analytics.png',
    imageAlt: 'Nexpura Analytics — sales by category, workshop throughput, and outstanding balances',
    intro:
      'Jewellery-specific reporting across sales, stock, workshop throughput, and outstanding balances.',
    bullets: [
      'Sales by period, category, staff member, and store',
      'Workshop throughput and repair completion rates',
      'Inventory turnover by category and location',
      'Outstanding and overdue balance summary',
      'Bespoke pipeline value and conversion by stage',
    ],
    useCase:
      'At the end of every month, owners get a clean read on which categories sold, which staff member converted the most bespoke leads, where stock is sitting too long, and how much is outstanding across customers — without exporting to a spreadsheet.',
  },
]

export default function FeaturesClient() {
  return (
    <div className="bg-m-ivory">
      {/* ============================================
          Hero
          ============================================ */}
      <section className="pt-24 pb-12 lg:pt-32 lg:pb-16 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p
            {...fadeUp()}
            className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-6"
          >
            Features
          </motion.p>
          <motion.h1
            {...fadeBlur}
            className="font-serif text-[42px] sm:text-[56px] lg:text-[clamp(2.75rem,5vw,4.5rem)] font-normal leading-[1.06] tracking-[-0.015em] text-m-charcoal mb-7"
          >
            Every module, <em className="italic">in detail</em>
          </motion.h1>
          <motion.p
            {...fadeUp(0.2)}
            className="text-[16px] sm:text-[18px] leading-[1.55] text-m-text-secondary max-w-[640px] mx-auto mb-10"
          >
            Nine modules, each built around a real jewellery workflow. Read
            what each one does, what it covers, and how it shows up on the
            shop floor and in the workshop.
          </motion.p>
          <motion.div
            {...fadeUp(0.35)}
            className="text-[13px] font-medium text-m-text-faint tracking-[0.05em] text-center leading-relaxed"
          >
            9 connected modules&nbsp;&nbsp;·&nbsp;&nbsp;Repairs and bespoke included&nbsp;&nbsp;·&nbsp;&nbsp;Migration support included&nbsp;&nbsp;·&nbsp;&nbsp;14-day free trial
          </motion.div>
        </div>
      </section>

      {/* ============================================
          In-page module index — anchor nav
          ============================================ */}
      {/* Module index — Batch 4 update.
          Previously: `overflow-x-auto` + `whitespace-nowrap` so the
          strip scrolled horizontally on every viewport.
          Now: flex-wrap + justify-center so all 9 modules fit on a
          single line at ≥1280px and wrap centred onto subsequent
          lines on tablet/mobile. Tightened item gap (gap-x-4 md:gap-x-5,
          previously gap-5 md:gap-7) so the canonical 9 fit cleanly
          inside the 1200px container without overflow. */}
      <nav
        aria-label="Module index"
        className="sticky top-[72px] z-30 bg-[rgba(250,247,242,0.95)] backdrop-blur-xl border-y border-m-border-soft overflow-x-hidden"
      >
        <div className="max-w-[1200px] mx-auto px-6 sm:px-10 lg:px-12">
          <ul
            role="list"
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 md:gap-x-5 py-3"
          >
            {MODULES.map((m, i) => (
              <li key={m.id}>
                <a
                  href={`#${m.id}`}
                  className="inline-flex items-baseline whitespace-nowrap font-sans text-[0.84rem] text-m-text-secondary hover:text-m-charcoal transition-colors duration-200"
                >
                  <span className="font-mono tabular-nums text-m-text-faint mr-1.5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {m.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* ============================================
          Module sections — every module's content in the DOM
          ============================================ */}
      <div className={`${SECTION_PADDING.standard} px-6 sm:px-10 lg:px-20`}>
        <div className={CONTAINER.wide}>
          <div className="space-y-16 md:space-y-20">
            {MODULES.map((m, i) => (
              <ModuleSection key={m.id} module={m} index={i + 1} />
            ))}
          </div>
        </div>
      </div>

      {/* ============================================
          Final CTA
          ============================================ */}
      <section className="py-24 lg:py-32 px-6 sm:px-10 lg:px-20 text-center border-t border-m-border-soft bg-m-charcoal">
        <motion.h2
          {...fadeBlur}
          className="font-serif text-[36px] sm:text-[48px] lg:text-[56px] font-normal leading-[1.12] tracking-[-0.01em] text-white mb-5"
        >
          Explore the workflows your team can finally connect.
        </motion.h2>
        <motion.p
          {...fadeUp(0.1)}
          className="text-[15px] md:text-[16px] text-m-champagne-soft mb-10 max-w-[600px] mx-auto leading-[1.6]"
        >
          Start the trial and walk through each module yourself, or book a
          guided walkthrough with our team.
        </motion.p>
        <motion.div
          {...fadeUp(0.2)}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center mb-6"
        >
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-full bg-white text-m-charcoal border border-white px-7 py-3.5 font-sans text-[0.95rem] font-medium transition-all duration-200 hover:bg-m-champagne-tint hover:-translate-y-0.5"
          >
            Start Free Trial
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-full bg-transparent text-white border border-white px-7 py-3.5 font-sans text-[0.95rem] font-medium transition-all duration-200 hover:bg-white/10 hover:-translate-y-0.5"
          >
            Book a Guided Demo
          </Link>
        </motion.div>
        <motion.p
          {...fadeUp(0.3)}
          className="font-sans text-[0.85rem] text-m-champagne-soft"
        >
          14-day free trial · No charge today · Cancel anytime before your trial ends
        </motion.p>
      </section>
    </div>
  )
}

// ============================================
// ModuleSection — full content card per module
// ============================================
function ModuleSection({ module, index }: { module: Module; index: number }) {
  const Icon = module.icon
  // Note: previously wrapped in <motion.section> with whileInView; that
  // hid sections below the fold from full-page screenshots and from any
  // user with reduced-motion preferences who scrolled past the trigger.
  // A plain <section> renders every module statically — animation isn't
  // load-bearing for this page and indexability + visibility matter more.
  return (
    <section
      id={module.id}
      aria-labelledby={`${module.id}-heading`}
      className="scroll-mt-[140px]"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-14 items-start">
        {/* Text column */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#F1E9D8] text-m-charcoal">
              <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="font-sans text-[0.78rem] font-medium tracking-[0.2em] uppercase text-m-text-faint">
              Module {String(index).padStart(2, '0')}
            </span>
          </div>
          <h2
            id={`${module.id}-heading`}
            className="font-serif text-m-charcoal text-[1.85rem] md:text-[2.2rem] leading-[1.15] tracking-[-0.005em] mb-4"
          >
            {module.title}
          </h2>
          <p className="font-sans text-m-text-secondary text-[1rem] md:text-[1.05rem] leading-[1.6] mb-6">
            {module.intro}
          </p>

          {/* Feature bullets */}
          <ul role="list" className="space-y-2.5 mb-7">
            {module.bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 font-sans text-[0.95rem] text-m-text-secondary leading-[1.55]"
              >
                <CheckMark />
                <span>{b}</span>
              </li>
            ))}
          </ul>

          {/* Use case — visually distinct */}
          <div className="border-l-2 border-m-champagne pl-5 py-1">
            <span className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-m-text-faint font-medium block mb-2">
              On the shop floor
            </span>
            <p className="font-sans text-[0.95rem] leading-[1.65] text-m-charcoal">
              {module.useCase}
            </p>
          </div>
        </div>

        {/* Visual column — real screenshot when supplied, otherwise
            stylised SVG mockup. Batch 4: removed `lg:sticky lg:top-[160px]`
            so the image stays planted in document flow next to its
            text — Kaitlyn flagged the prior sticky behaviour as parallax-y
            on long scrolls. */}
        <div>
          {module.image ? (
            <div className="relative rounded-2xl overflow-hidden bg-m-white-soft border border-m-border-soft shadow-[0_18px_45px_rgba(0,0,0,0.06)]">
              <img
                src={module.image}
                alt={module.imageAlt ?? `${module.title} — product screenshot`}
                className="w-full h-full object-cover object-top"
                style={{ aspectRatio: '16/10' }}
              />
            </div>
          ) : (
            <div
              className={`relative ${CARD.base} ${CARD.paddingStandard} min-h-[260px] flex flex-col items-center justify-center text-center`}
              aria-label={`${module.title} preview — placeholder`}
            >
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#F1E9D8] text-m-charcoal mb-4">
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              </span>
              <span className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-m-text-faint mb-2">
                Mockup placeholder
              </span>
              <span className="font-serif text-m-charcoal text-[1.05rem] leading-[1.3] mb-1">
                {module.title} preview coming
              </span>
              <span className="font-sans text-[0.85rem] text-m-text-secondary leading-[1.55] max-w-[280px]">
                A real screenshot will replace this placeholder once the
                design assets are finalised.
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function CheckMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="mt-1.5 shrink-0 text-m-charcoal"
    >
      <path d="M3 7l3 3 5-6" />
    </svg>
  )
}
