'use client'

// ============================================
// Platform page — 10-section product tour client.
// Rebuilt 2026-04-28 (Batch 1 site refinement).
// Imports the existing landing-page tokens (_tokens.ts) and reuses the
// premium SaaS aesthetic established by LandingPlatformModules and
// LandingDigitalPassport so the page feels native, not a fork.
//
// All copy is verbatim from Kaitlyn's Batch 1 spec.
//
// Tabs (Section 3) keep every panel rendered in the DOM (hidden via
// `hidden` attribute on inactive panels) so search engines and screen
// readers can read every module's content even when the panel isn't
// visible — a current bug on /features.
// ============================================

import Link from 'next/link'
import { useState } from 'react'
import {
  SECTION_PADDING,
  HEADING,
  INTRO_SPACING,
  CARD,
  BUTTON,
  CONTAINER,
} from '@/components/landing/_tokens'

// ============================================
// Section 3 — Module tab data
// ============================================
type ModuleTab = {
  id: string
  label: string
  heading: string
  intro: string
  bullets: string[]
}

const MODULE_TABS: ModuleTab[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    heading: 'Owner-grade visibility, the moment you log in.',
    intro:
      'A single screen for what needs attention across sales, stock, repairs, bespoke jobs, and customer activity.',
    bullets: [
      "See today's sales, overdue repairs, and bespoke approvals waiting on a decision",
      'Track unpaid balances and upcoming collections without opening a separate report',
      'Spot low-stock pieces before a customer asks for them',
    ],
  },
  {
    id: 'pos',
    label: 'POS',
    heading: 'Process every sale connected to the customer and the piece.',
    intro:
      'Fast checkout that links each transaction to the customer record, the item, and the post-sale service trail.',
    bullets: [
      'Connect each sale to the customer and the item record',
      'Manage deposits, balances, and collections in one place',
      'Capture trade-ins, layby, gift cards, and split tender without leaving the screen',
    ],
  },
  {
    id: 'repairs',
    label: 'Repairs',
    heading: 'Track every repair from intake to collection.',
    intro:
      'Structured intake, clear status, and visible deposit/balance — across the front counter and the workshop bench.',
    bullets: [
      'Track every repair from intake to collection',
      'See which jobs are overdue before a customer asks',
      'Give the workshop one place to update status, photos, and notes',
    ],
  },
  {
    id: 'bespoke',
    label: 'Bespoke',
    heading: 'Run bespoke commissions with structure, not memory.',
    intro:
      'A workflow that holds the brief, sketches, sourcing, milestones, deposits, and approvals in one place.',
    bullets: [
      'Keep bespoke approvals and milestones visible to the team',
      'Track deposits, balances, and stage-gate sign-off',
      'Connect every bespoke job back to the customer and the final piece record',
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    heading: 'See what you have, where it is, and what needs action.',
    intro:
      'Live stock for finished pieces, stones, metals, components, memo, and consignment — with full provenance.',
    bullets: [
      'See low stock before it affects sales',
      'Track location, cost, provenance, and movement history per piece',
      'Filter by status (in stock, reserved, on memo, low stock, archived)',
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    heading: 'One profile per customer, every interaction connected.',
    intro:
      'Purchases, repairs, bespoke jobs, deposits, preferences, anniversaries, and service notes in one record.',
    bullets: [
      'Connect each sale to the customer and the item record',
      'Surface VIP signals, anniversaries, and follow-up reminders',
      'See repair and service history alongside purchase history',
    ],
  },
  {
    id: 'passports',
    label: 'Digital Passports',
    heading: 'Verify eligible pieces with a digital passport.',
    intro:
      'A QR-verifiable record of materials, provenance, craftsmanship, service history, and aftercare — issued from the same record the workshop already maintains.',
    bullets: [
      'Verify eligible pieces with a digital passport',
      'Customers can scan and confirm authenticity instantly',
      'Service history and aftercare attach to the same record over time',
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    heading: 'Decisions from jewellery metrics, not generic retail reports.',
    intro:
      'Sales by category and staff, workshop throughput, repair completion rates, outstanding balances, and stock turnover.',
    bullets: [
      'Track sales by period, category, and staff member',
      'Monitor workshop throughput and repair completion rates',
      'See outstanding balances and overdue summaries at a glance',
    ],
  },
]

// ============================================
// Section 5 — Owner Command Centre cards
// ============================================
const COMMAND_CARDS: { title: string; placeholder: string }[] = [
  { title: 'Overdue repairs', placeholder: '4 jobs past due' },
  { title: 'Low stock', placeholder: '12 SKUs below threshold' },
  { title: 'Unpaid balances', placeholder: '$8,420 across 9 customers' },
  { title: 'Bespoke approvals waiting', placeholder: '3 awaiting client sign-off' },
  { title: 'Upcoming collections', placeholder: '6 pieces ready this week' },
  { title: 'Top-selling categories', placeholder: 'Engagement · Stud earrings · Chains' },
  { title: 'Passport activity', placeholder: '14 verifications in the last 30 days' },
  { title: 'Staff workload', placeholder: 'Workshop capacity at 78%' },
]

// ============================================
// Section 6 — Role-based views (verbatim copy)
// ============================================
const ROLE_CARDS: { role: string; body: string }[] = [
  {
    role: 'Owners',
    body:
      'See revenue, overdue work, stock health, and team activity across every store from one dashboard.',
  },
  {
    role: 'Sales teams',
    body:
      'Process sales, look up customers, and pull up item history in seconds without switching screens.',
  },
  {
    role: 'Workshop staff',
    body:
      'See assigned repairs and bespoke jobs with photos, notes, deposits, and due dates in one queue.',
  },
  {
    role: 'Admin',
    body:
      'Manage staff access, plan settings, billing, and store-level configuration in one place.',
  },
]

// ============================================
// Section 8 — Migration steps (verbatim)
// ============================================
const MIGRATION_STEPS: { num: string; title: string; body: string }[] = [
  {
    num: '01',
    title: 'Workflow audit',
    body: 'We map your current tools, processes, and data so nothing critical gets dropped.',
  },
  {
    num: '02',
    title: 'Data preparation',
    body: 'Customer, inventory, repair, and supplier records are cleaned and structured for migration.',
  },
  {
    num: '03',
    title: 'Customer and inventory import',
    body: 'Records move across with provenance — every imported row keeps its source and ID.',
  },
  {
    num: '04',
    title: 'Platform configuration',
    body: 'Stores, staff, taxes, payment methods, and workflow settings are configured for your business.',
  },
  {
    num: '05',
    title: 'Staff training',
    body: 'Guided onboarding for sales, workshop, and admin teams on the workflows that matter most.',
  },
  {
    num: '06',
    title: 'Go-live support',
    body: 'You launch on Nexpura with practical support so the transition is controlled, not chaotic.',
  },
]

// ============================================
// Section 9 — Security mini bullets
// ============================================
const SECURITY_BULLETS: string[] = [
  'Role-based access for every staff member',
  'Secure login with modern authentication',
  'Encrypted data in transit and at rest',
  'Automated daily backups',
  'Stripe-handled payments — card data never touches our servers',
  'Your data stays yours — no advertising, no resale',
]

// ============================================
// Page
// ============================================
export default function PlatformPageClient() {
  const [activeTab, setActiveTab] = useState<string>(MODULE_TABS[0].id)

  return (
    <div className="bg-m-ivory">
      {/* ============================================
          1. Platform Hero
          ============================================ */}
      <section
        id="platform-hero"
        className="px-6 py-20 md:py-24 lg:py-28 text-center bg-m-ivory"
        aria-labelledby="platform-hero-heading"
      >
        <div className={CONTAINER.narrow}>
          <span className={HEADING.eyebrow}>The Platform</span>
          <h1
            id="platform-hero-heading"
            className="font-serif text-m-charcoal text-[2.4rem] md:text-[3.2rem] lg:text-[3.6rem] leading-[1.06] tracking-[-0.015em] mb-6"
          >
            The jewellery operating system behind every sale, repair,
            bespoke order, and passport.
          </h1>
          <p className="font-sans text-m-text-secondary text-[1.05rem] md:text-[1.15rem] leading-[1.55] max-w-[680px] mx-auto mb-9">
            One platform that connects the front counter to the workshop,
            so sales, repairs, bespoke jobs, customers, stock, and digital
            trust all live in the same record.
          </p>
          <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-8">
            <Link href="/signup" className={BUTTON.primary}>
              Start Free Trial
            </Link>
            <Link href="/contact" className={BUTTON.secondary}>
              Book a Guided Demo
            </Link>
          </div>
          <p className="font-sans text-[0.78rem] tracking-[0.2em] uppercase text-m-text-faint font-medium">
            POS · Repairs · Bespoke · Inventory · CRM · Passports · Analytics
          </p>
        </div>
      </section>

      {/* ============================================
          2. Connected Workflow Map
          ============================================ */}
      <section
        id="platform-workflow"
        className={`bg-m-white-soft border-y border-m-border-soft ${SECTION_PADDING.standard}`}
        aria-labelledby="platform-workflow-heading"
      >
        <div className={CONTAINER.wide}>
          <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
            <span className={HEADING.eyebrow}>Connected Workflow</span>
            <h2 id="platform-workflow-heading" className={HEADING.h2}>
              One workflow, from first enquiry to aftercare.
            </h2>
            <p className={`${HEADING.subhead} max-w-[660px] mx-auto`}>
              Every step links to the customer record and the piece record, so
              nothing is rekeyed and nothing falls through the gaps between
              your team and your workshop.
            </p>
          </div>
          <WorkflowMap />
        </div>
      </section>

      {/* ============================================
          3. Interactive Product Tour (8 module tabs)
          ============================================ */}
      <section
        id="platform-tour"
        className={`bg-m-ivory ${SECTION_PADDING.standard}`}
        aria-labelledby="platform-tour-heading"
      >
        <div className={CONTAINER.wide}>
          <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
            <span className={HEADING.eyebrow}>Product Tour</span>
            <h2 id="platform-tour-heading" className={HEADING.h2}>
              Tour the modules your team will actually live in.
            </h2>
            <p className={`${HEADING.subhead} max-w-[640px] mx-auto`}>
              Each module is built around a real jewellery workflow — and
              every record stays connected across them.
            </p>
          </div>

          {/* Tab list — horizontal scroll on mobile */}
          <div
            role="tablist"
            aria-label="Product tour modules"
            className="flex flex-wrap justify-center gap-2 md:gap-3 mb-8 md:mb-10"
          >
            {MODULE_TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'inline-flex items-center justify-center rounded-full px-4 md:px-5 py-2 md:py-2.5',
                    'font-sans text-[0.85rem] md:text-[0.9rem] font-medium',
                    'border transition-all duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-m-champagne focus-visible:ring-offset-2',
                    isActive
                      ? 'bg-m-charcoal text-white border-m-charcoal'
                      : 'bg-transparent text-m-text-secondary border-m-border-soft hover:border-m-charcoal hover:text-m-charcoal',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab panels — every panel is in the DOM at all times.
              Inactive panels are visually hidden but their content stays
              indexable. We use a sr-only-style approach (clip + position
              absolute) instead of `display:none` because Tailwind's
              `grid` utility otherwise overrides the [hidden] UA rule
              (Tailwind's `display: grid` has higher specificity than
              the user-agent stylesheet). Sticking with the visible
              panel as a `display:grid` block. */}
          <div className="max-w-[920px] mx-auto relative">
            {MODULE_TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <div
                  key={tab.id}
                  id={`panel-${tab.id}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${tab.id}`}
                  aria-hidden={!isActive}
                  className={
                    isActive
                      ? `${CARD.base} ${CARD.paddingStandard} grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 md:gap-10`
                      : 'sr-only'
                  }
                >
                  <div>
                    <h3 className="font-serif text-m-charcoal text-[1.4rem] md:text-[1.6rem] leading-[1.2] mb-3">
                      {tab.heading}
                    </h3>
                    <p className="font-sans text-m-text-secondary text-[0.97rem] leading-[1.6] mb-5">
                      {tab.intro}
                    </p>
                    <ul role="list" className="space-y-2.5">
                      {tab.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-start gap-3 text-[0.95rem] text-m-text-secondary leading-[1.55]"
                        >
                          <CheckMark />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Visual placeholder column — flagged as a placeholder
                      since real screenshots/mockups for each module aren't
                      shipped yet. Stays in the DOM so the panel always
                      reads as a complete unit, never an empty shell. */}
                  <ModulePreviewPlaceholder label={tab.label} />
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============================================
          4. One Customer, One Item History
          ============================================ */}
      <section
        id="platform-record"
        className={`bg-m-white-soft border-y border-m-border-soft ${SECTION_PADDING.standard}`}
        aria-labelledby="platform-record-heading"
      >
        <div className={CONTAINER.wide}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <span className={HEADING.eyebrow}>One connected record</span>
              <h2 id="platform-record-heading" className={HEADING.h2}>
                Every customer, piece, service, and sale in one record.
              </h2>
              <p className="mt-5 font-sans text-m-text-secondary text-[1rem] md:text-[1.05rem] leading-[1.6]">
                Records connect across the system — when a customer
                returns, your team sees their purchase history, repair
                history, bespoke jobs, deposits, preferences, and any
                pieces they own that carry a digital passport. No
                rekeying, no tab-switching.
              </p>
              <ul role="list" className="mt-6 space-y-2.5">
                {[
                  'Connect each sale to the customer and the item record',
                  'Repairs, bespoke jobs, and aftercare attach to the piece',
                  'Service history travels with the passport for the life of the piece',
                ].map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-3 text-[0.97rem] text-m-text-secondary leading-[1.55]"
                  >
                    <CheckMark />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <RecordPlaceholder />
          </div>
        </div>
      </section>

      {/* ============================================
          5. Owner Command Centre (8 cards)
          ============================================ */}
      <section
        id="platform-command"
        className={`bg-m-ivory ${SECTION_PADDING.standard}`}
        aria-labelledby="platform-command-heading"
      >
        <div className={CONTAINER.wide}>
          <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
            <span className={HEADING.eyebrow}>Command Centre</span>
            <h2 id="platform-command-heading" className={HEADING.h2}>
              Know what needs attention before your team has to ask.
            </h2>
            <p className={`${HEADING.subhead} max-w-[660px] mx-auto`}>
              The owner dashboard surfaces the eight signals that actually
              matter day-to-day — the things you would otherwise chase down
              by walking the floor.
            </p>
          </div>
          <ul
            role="list"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5"
          >
            {COMMAND_CARDS.map((card) => (
              <li
                key={card.title}
                className={`flex flex-col ${CARD.base} ${CARD.paddingCompact} ${CARD.hover}`}
              >
                <span className="font-sans text-[0.7rem] uppercase tracking-[0.2em] text-[#8A8276] mb-3">
                  {card.title}
                </span>
                <span className="font-serif text-m-charcoal text-[1.05rem] leading-[1.3]">
                  {card.placeholder}
                </span>
                <span className="mt-3 font-sans text-[0.75rem] text-m-text-faint italic">
                  Sample data — your dashboard shows live numbers from your business.
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================
          6. Role-Based Views
          ============================================ */}
      <section
        id="platform-roles"
        className={`bg-m-white-soft border-y border-m-border-soft ${SECTION_PADDING.standard}`}
        aria-labelledby="platform-roles-heading"
      >
        <div className={CONTAINER.wide}>
          <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
            <span className={HEADING.eyebrow}>Role-based views</span>
            <h2 id="platform-roles-heading" className={HEADING.h2}>
              Built for owners, sales teams, workshop staff, and admin.
            </h2>
            <p className={`${HEADING.subhead} max-w-[640px] mx-auto`}>
              Each role sees the data and tools they need — and access is
              controlled by the people who run the business.
            </p>
          </div>
          <ul
            role="list"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6"
          >
            {ROLE_CARDS.map((card) => (
              <li
                key={card.role}
                className={`flex flex-col ${CARD.base} ${CARD.paddingStandard} ${CARD.hover}`}
              >
                <h3 className={`${HEADING.h3} mb-3`}>{card.role}</h3>
                <p className="font-sans text-[0.95rem] leading-[1.6] text-m-text-secondary">
                  {card.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ============================================
          7. Digital Passport Integration
          ============================================ */}
      <section
        id="platform-passport"
        className={`bg-m-ivory ${SECTION_PADDING.premium}`}
        aria-labelledby="platform-passport-heading"
      >
        <div className={CONTAINER.wide}>
          <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
            <span className={HEADING.eyebrow}>Digital Passports</span>
            <h2 id="platform-passport-heading" className={HEADING.h2}>
              Proof of authenticity, built into the platform.
            </h2>
            <p className={`${HEADING.subhead} max-w-[660px] mx-auto`}>
              Every eligible piece can be issued a QR-verifiable digital
              passport — generated from the same record the workshop and
              sales team already maintain. No second system, no rekeying.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 max-w-[900px] mx-auto">
            {[
              { title: 'Materials & provenance', body: 'Metals, stones, sourcing, and craftsmanship recorded once and travelling with the piece.' },
              { title: 'Service history', body: 'Repairs, resizing, cleaning, and inspections attach to the same record over time.' },
              { title: 'Resale confidence', body: 'Customers can verify authenticity instantly with a QR scan, even years after the original sale.' },
            ].map((c) => (
              <div
                key={c.title}
                className={`flex flex-col ${CARD.base} ${CARD.paddingCompact}`}
              >
                <h3 className="font-serif text-m-charcoal text-[1.05rem] leading-[1.25] mb-2">
                  {c.title}
                </h3>
                <p className="font-sans text-[0.92rem] leading-[1.55] text-m-text-secondary">
                  {c.body}
                </p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10 md:mt-12">
            <Link
              href="/verify"
              className="inline-flex items-center gap-2 font-sans text-[0.95rem] font-medium text-m-charcoal border-b border-m-charcoal pb-0.5 transition-opacity duration-200 hover:opacity-70"
            >
              View Passport Verification
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          8. Migration & Setup (6 steps)
          ============================================ */}
      <section
        id="platform-migration"
        className={`bg-m-white-soft border-y border-m-border-soft ${SECTION_PADDING.standard}`}
        aria-labelledby="platform-migration-heading"
      >
        <div className={CONTAINER.wide}>
          <div className={`${CONTAINER.narrow} text-center ${INTRO_SPACING.standard}`}>
            <span className={HEADING.eyebrow}>Migration & Setup</span>
            <h2 id="platform-migration-heading" className={HEADING.h2}>
              Switch without losing your current workflow.
            </h2>
            <p className={`${HEADING.subhead} max-w-[640px] mx-auto`}>
              A six-step process designed to move your business onto Nexpura
              with provenance, confidence, and minimal disruption.
            </p>
          </div>
          <ol
            role="list"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6"
          >
            {MIGRATION_STEPS.map((s) => (
              <li
                key={s.num}
                className={`relative flex flex-col ${CARD.base} ${CARD.paddingStandard}`}
              >
                <span
                  aria-hidden="true"
                  className="font-sans text-[0.78rem] font-medium tracking-[0.2em] uppercase text-m-champagne mb-3"
                >
                  Step {s.num}
                </span>
                <h3 className="font-serif text-m-charcoal text-[1.15rem] leading-[1.25] mb-3">
                  {s.title}
                </h3>
                <p className="font-sans text-[0.93rem] leading-[1.6] text-m-text-secondary">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================================
          9. Security & Trust mini
          ============================================ */}
      <section
        id="platform-security"
        className={`bg-m-ivory ${SECTION_PADDING.standard}`}
        aria-labelledby="platform-security-heading"
      >
        <div className={CONTAINER.wide}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-16 items-start">
            <div>
              <span className={HEADING.eyebrow}>Security & Trust</span>
              <h2 id="platform-security-heading" className={HEADING.h2}>
                Your business and customer data, properly protected.
              </h2>
              <p className="mt-5 font-sans text-m-text-secondary text-[1rem] leading-[1.6]">
                The platform is built with access control, encryption, and
                handled-payments at the foundations — and your data stays
                yours.
              </p>
              <Link
                href="/security"
                className="mt-6 inline-flex items-center gap-2 font-sans text-[0.95rem] font-medium text-m-charcoal border-b border-m-charcoal pb-0.5 transition-opacity duration-200 hover:opacity-70"
              >
                See full security details
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              {SECURITY_BULLETS.map((b) => (
                <li
                  key={b}
                  className={`flex items-start gap-3 ${CARD.base} ${CARD.paddingCompact}`}
                >
                  <CheckMark />
                  <span className="font-sans text-[0.95rem] leading-[1.55] text-m-text-secondary">
                    {b}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============================================
          10. Final CTA
          ============================================ */}
      <section
        id="platform-cta"
        className="px-6 py-20 md:py-24 lg:py-28 text-center bg-m-charcoal text-white"
        aria-labelledby="platform-cta-heading"
      >
        <div className={CONTAINER.narrow}>
          <h2
            id="platform-cta-heading"
            className="font-serif text-white text-[2rem] md:text-[2.6rem] leading-[1.12] tracking-[-0.005em] mb-5"
          >
            See the jewellery operating system in action.
          </h2>
          <p className="font-sans text-m-champagne-soft text-[1rem] md:text-[1.1rem] leading-[1.6] max-w-[600px] mx-auto mb-9">
            Start the trial and explore the modules at your own pace, or
            book a guided walkthrough with our team.
          </p>
          <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-6">
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
          </div>
          <p className="font-sans text-[0.85rem] text-m-champagne-soft">
            14-day free trial · No charge today · Cancel anytime before your trial ends
          </p>
        </div>
      </section>
    </div>
  )
}

// ============================================
// Section 2 — WorkflowMap (pill-node + connector flow)
// ============================================
function WorkflowMap() {
  const NODES = [
    'Enquiry',
    'Quote',
    'Sale',
    'Repair / Bespoke Job',
    'Payment',
    'Passport',
    'Aftercare',
    'Reporting',
  ]
  return (
    <div className="relative">
      {/* Desktop: horizontal flow with chevron connectors */}
      <ol
        role="list"
        className="hidden lg:flex flex-wrap items-center justify-center gap-x-2 gap-y-3"
      >
        {NODES.map((node, i) => (
          <li key={node} className="flex items-center gap-2">
            <span
              className={`${CARD.base} px-4 py-2.5 font-sans text-[0.88rem] font-medium text-m-charcoal whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.04)]`}
            >
              {node}
            </span>
            {i < NODES.length - 1 && (
              <span aria-hidden="true" className="text-m-champagne">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* Mobile/tablet: vertical flow */}
      <ol role="list" className="lg:hidden flex flex-col items-center gap-2">
        {NODES.map((node, i) => (
          <li key={node} className="flex flex-col items-center gap-1">
            <span
              className={`${CARD.base} px-4 py-2.5 font-sans text-[0.88rem] font-medium text-m-charcoal text-center min-w-[220px]`}
            >
              {node}
            </span>
            {i < NODES.length - 1 && (
              <span aria-hidden="true" className="text-m-champagne my-1">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14M6 13l6 6 6-6" />
                </svg>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

// ============================================
// Section 3 — Module preview placeholder
// (Real product mockups not yet supplied — flagged as placeholder so
// Kaitlyn can swap in real screenshots in Batch 2/3.)
// ============================================
function ModulePreviewPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="relative rounded-2xl border border-dashed border-m-border-hover bg-m-ivory/60 min-h-[220px] flex flex-col items-center justify-center px-6 py-8 text-center"
      aria-label={`${label} module preview — placeholder`}
    >
      <span className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-m-text-faint mb-2">
        Mockup placeholder
      </span>
      <span className="font-serif text-m-charcoal text-[1.1rem] leading-[1.3] mb-1">
        {label} preview coming
      </span>
      <span className="font-sans text-[0.85rem] text-m-text-secondary leading-[1.5] max-w-[280px]">
        A real {label.toLowerCase()} screenshot will replace this placeholder
        once the design assets are finalised.
      </span>
    </div>
  )
}

// ============================================
// Section 4 — Customer/Item record placeholder
// ============================================
function RecordPlaceholder() {
  return (
    <div
      className={`relative ${CARD.base} px-6 py-7 md:px-8 md:py-9 shadow-[0_18px_45px_rgba(0,0,0,0.05)]`}
      aria-label="Customer and item record — placeholder visual"
    >
      <div className="flex items-start justify-between mb-6 pb-4 border-b border-m-border-soft">
        <div>
          <div className="font-sans text-[0.65rem] uppercase tracking-[0.22em] text-[#8A8276] mb-1">
            Customer
          </div>
          <div className="font-serif text-m-charcoal text-[1.1rem] leading-tight">
            Eleanor Whitfield
          </div>
          <div className="font-sans text-[0.78rem] text-m-text-secondary mt-1">
            Reference · NX-CUST-04219
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-m-champagne-soft border border-m-champagne text-[0.7rem] font-medium tracking-[0.05em] text-m-charcoal">
          VIP
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <RecordStat label="Lifetime spend" value="$24,180" />
        <RecordStat label="Pieces owned" value="6" />
        <RecordStat label="Open repairs" value="1" />
        <RecordStat label="Bespoke jobs" value="2" />
      </div>

      <div className="border-t border-m-border-soft pt-4">
        <div className="font-sans text-[0.65rem] uppercase tracking-[0.22em] text-[#8A8276] mb-3">
          Activity
        </div>
        <ul role="list" className="space-y-2 text-[0.85rem]">
          {[
            ['14 Mar 2026', 'Repair · Solitaire ring · Resize'],
            ['22 Sep 2025', 'Sale · Stud earrings · 18ct white gold'],
            ['08 Feb 2025', 'Bespoke handover · Solitaire engagement ring'],
          ].map(([date, label]) => (
            <li key={date} className="flex items-baseline gap-3">
              <span className="font-sans tabular-nums text-[#8A8276] w-[88px] flex-shrink-0">
                {date}
              </span>
              <span className="font-sans text-m-charcoal">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-5 font-sans text-[0.72rem] text-m-text-faint italic">
        Sample record — your view shows live customer and piece data.
      </p>
    </div>
  )
}

function RecordStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-m-ivory border border-m-border-soft px-3 py-2.5">
      <div className="font-sans text-[0.62rem] uppercase tracking-[0.18em] text-[#8A8276] mb-0.5">
        {label}
      </div>
      <div className="font-serif text-m-charcoal text-[1.05rem] leading-tight">
        {value}
      </div>
    </div>
  )
}

// ============================================
// Shared check mark
// ============================================
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
