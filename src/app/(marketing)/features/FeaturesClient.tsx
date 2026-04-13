'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
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

type Feature = {
  id: string
  title: string
  tagline: string
  icon: LucideIcon
  features: string[]
}

const sections: Feature[] = [
  {
    id: 'pos',
    title: 'Point of Sale',
    icon: ShoppingBag,
    tagline:
      'A fast, intuitive POS designed for the jewellery shop floor. Process sales, layby, gift vouchers, and returns without slowing down service.',
    features: [
      'Fast barcode and SKU scanning',
      'Layby and payment plan support',
      'Gift voucher creation and redemption',
      'Multiple payment methods, split tender',
      'Automatic customer creation from sale',
      'Real-time inventory deduction',
      'Receipt printing and email delivery',
      'Daily cash reconciliation',
    ],
  },
  {
    id: 'repairs',
    title: 'Repairs & Workshop',
    icon: Wrench,
    tagline:
      'Complete repair management from the first phone call to collection. Every job gets a Command Center with full visibility.',
    features: [
      'Digital intake with photos',
      'Step by step workflow from intake to collected',
      'Customer notifications at each stage',
      'Labour and material cost tracking',
      'Repair deposit and balance management',
      'Overdue alerts on the dashboard',
      'Repair number sequencing and labels',
      'Batch printing of repair tags',
    ],
  },
  {
    id: 'bespoke',
    title: 'Bespoke Commissions',
    icon: Gem,
    tagline:
      'Manage custom jewellery commissions from concept to delivery. Track design stages, client approvals, and production milestones.',
    features: [
      'Commission-specific workflow and stages',
      'Design brief and reference image storage',
      'Client approval gates',
      'Material specifications and stone requirements',
      'Milestone-based deposit schedules',
      'Production timeline tracking',
      'Communication log with client',
      'Handover and certificate management',
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: Package,
    tagline:
      'Full stock control across finished pieces, loose stones, metals, findings, and raw materials — with provenance tracking.',
    features: [
      'Multi-category inventory management',
      'SKU and barcode management',
      'Reorder level alerts',
      'Stock take and variance tracking',
      'Stock tracking across multiple locations with transfers',
      'Supplier linkage per item',
      'Full provenance and cost history',
      'Batch import from spreadsheets',
    ],
  },
  {
    id: 'customers',
    title: 'Customers',
    icon: Users,
    tagline:
      'A CRM built for jewellers. Know your customers — their purchase history, preferences, upcoming birthdays, and lifetime value.',
    features: [
      'Complete purchase and repair history',
      'VIP tagging and custom tags',
      'Birthday and anniversary reminders',
      'Customer notes and communication log',
      'Email campaigns and follow-ups',
      'Customer lifetime value reporting',
      'Import existing customer lists',
      'Merge duplicate customer records',
    ],
  },
  {
    id: 'invoices',
    title: 'Invoicing',
    icon: FileText,
    tagline:
      "Professional invoices that reflect your brand. Track what's paid, what's outstanding, and what's overdue.",
    features: [
      'Professional invoice templates',
      'Partial payment and balance tracking',
      'Payment due date and overdue alerts',
      'PDF generation and email delivery',
      'GST / VAT / tax handling',
      'Linked to repairs and bespoke jobs',
      'Outstanding balance dashboard',
      'Xero and accounting export',
    ],
  },
  {
    id: 'suppliers',
    title: 'Suppliers',
    icon: Truck,
    tagline:
      'Manage your supplier relationships, purchase orders, and stock receiving in one place.',
    features: [
      'Supplier directory with terms',
      'Purchase order creation and tracking',
      'Stock receiving and cost recording',
      'Supplier-linked inventory items',
      'Outstanding purchase order tracking',
      'Supplier invoice reconciliation',
    ],
  },
  {
    id: 'command-center',
    title: 'Command Centers',
    icon: LayoutGrid,
    tagline:
      'The flagship Nexpura feature. Every repair and bespoke job gets its own dedicated operational screen.',
    features: [
      'Full job details and history in one screen',
      'Live financial summary',
      'Stage action buttons with notifications',
      'Line items, labour, and materials breakdown',
      'Activity timeline of every action',
      'Customer communication history',
      'Payment recording with partial support',
      'Linked photos and documents',
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics & Reporting',
    icon: BarChart3,
    tagline:
      'Understand your business with reports designed around jewellery metrics — not generic retail analytics.',
    features: [
      'Sales by period, category, and staff',
      'Workshop throughput and completion rates',
      'Customer acquisition and retention metrics',
      'Outstanding and overdue summary',
      'Inventory turnover analysis',
      'Daily and period closing reports',
      'Exportable to CSV for accountants',
    ],
  },
]

export default function FeaturesClient() {
  const [activeIndex, setActiveIndex] = useState(0)
  const navRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const activeSection = sections[activeIndex]

  // Auto-scroll active tab into view in the nav
  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    const nav = navRef.current
    if (!el || !nav) return
    const elRect = el.getBoundingClientRect()
    const navRect = nav.getBoundingClientRect()
    const target =
      elRect.left - navRect.left + nav.scrollLeft - navRect.width / 2 + elRect.width / 2
    nav.scrollTo({ left: target, behavior: 'smooth' })
  }, [activeIndex])

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="pt-20 pb-10 lg:pt-28 lg:pb-10 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p
            {...fadeUp()}
            className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-6"
          >
            The Platform
          </motion.p>
          <motion.h1
            {...fadeBlur}
            className="font-serif text-4xl sm:text-5xl lg:text-[clamp(2.75rem,5vw,4.25rem)] font-normal leading-[1.15] tracking-[-0.01em] text-stone-900 mb-7"
          >
            Every feature, <em className="italic">crafted for jewellers</em>
          </motion.h1>
          <motion.p
            {...fadeUp(0.2)}
            className="text-base leading-relaxed text-stone-500 max-w-[640px] mx-auto mb-10"
          >
            From the shop floor to the workshop, Nexpura brings sales, repairs, bespoke, inventory, customer records, and financial workflows into one connected system.
          </motion.p>
          {/* Proof strip */}
          <motion.div
            {...fadeUp(0.35)}
            className="flex items-center justify-center gap-x-3 gap-y-2 flex-wrap"
          >
            {['9 connected modules', 'Built for jewellers', 'Repairs + bespoke built in', 'Guided migration included'].map((item) => (
              <span
                key={item}
                className="inline-flex items-center px-4 py-2 rounded-full border border-stone-200 bg-stone-50 text-[0.8125rem] font-normal text-stone-600 whitespace-nowrap"
              >
                {item}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Tab nav */}
      <div className="sticky top-[72px] z-30 bg-white/95 backdrop-blur-xl border-y border-black/[0.06]">
        <div
          ref={navRef}
          className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-20 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex items-end whitespace-nowrap relative">
            {sections.map((s, i) => {
              const isActive = activeIndex === i
              return (
                <button
                  key={s.id}
                  ref={(el) => { itemRefs.current[i] = el }}
                  onClick={() => setActiveIndex(i)}
                  className={`relative flex flex-col items-start gap-1 py-5 pr-10 lg:pr-14 cursor-pointer transition-opacity duration-300 shrink-0 ${
                    isActive ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                  }`}
                >
                  <span className={`text-[0.625rem] font-mono tabular-nums tracking-[0.15em] ${isActive ? 'text-stone-900' : 'text-stone-400'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={`font-serif leading-none transition-colors duration-300 ${isActive ? 'text-stone-900 text-base font-medium' : 'text-stone-500 text-[0.9375rem]'}`}>
                    {s.title}
                  </span>
                  {/* Active underline */}
                  {isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-stone-900 pr-10 lg:pr-14"
                      style={{ right: 'var(--tab-pr, 2.5rem)' }}
                      transition={{ duration: 0.4, ease: EASE }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tab content panel */}
      <div className="px-6 sm:px-10 lg:px-20 py-20 lg:py-28">
        <div className="max-w-[1200px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16"
            >
              {/* Left: title + tagline */}
              <div className="lg:col-span-5">
                <div className="flex items-center gap-4 mb-6">
                  {(() => { const Icon = activeSection.icon; return <Icon size={28} strokeWidth={1.25} className="text-stone-900" /> })()}
                  <span className="text-sm tabular-nums text-stone-300 font-medium">
                    {String(activeIndex + 1).padStart(2, '0')}
                  </span>
                </div>
                <h2 className="font-serif text-3xl lg:text-[2.5rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-5">
                  {activeSection.title}
                </h2>
                <p className="text-[0.9375rem] lg:text-base leading-relaxed text-stone-500">
                  {activeSection.tagline}
                </p>
              </div>

              {/* Right: feature list */}
              <ul className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 self-start">
                {activeSection.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 text-[0.9375rem] text-stone-700 border-b border-stone-100 pb-4"
                  >
                    <span className="mt-2 w-1 h-1 rounded-full bg-stone-900 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* CTA */}
      <section className="py-20 lg:py-36 px-6 sm:px-10 lg:px-20 text-center border-t border-black/[0.06]">
        <motion.h2
          {...fadeBlur}
          className="font-serif text-3xl sm:text-4xl lg:text-[3.75rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-10 italic"
        >
          See it in action
        </motion.h2>
        <motion.div {...fadeUp(0.1)} className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link
            href="/contact"
            className="
              inline-flex items-center justify-center
              min-w-[180px] px-10 py-4 md:min-w-[200px] md:px-12
              bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]
              rounded-full
              shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]
              transition-shadow duration-400
              hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]
              relative overflow-hidden cursor-pointer
            "
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
            <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">
              Book a Demo
            </span>
          </Link>
          <Link
            href="/platform"
            className="text-[0.9375rem] text-stone-700 underline underline-offset-4 hover:opacity-60 transition-opacity duration-300"
          >
            See the Platform
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
