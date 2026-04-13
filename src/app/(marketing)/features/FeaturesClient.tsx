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
  benefit: string
  image: string | null
  icon: LucideIcon
  features: string[]
}

const sections: Feature[] = [
  {
    id: 'pos',
    title: 'Point of Sale',
    icon: ShoppingBag,
    image: null,
    tagline: 'A jewellery POS built for fast checkout, flexible payments, and accurate stock movement.',
    benefit: 'Keep checkout fast without losing stock accuracy.',
    features: [
      'Fast barcode and SKU scanning',
      'Multiple payment methods and split tender',
      'Layby and payment plan support',
      'Real-time inventory deduction',
    ],
  },
  {
    id: 'repairs',
    title: 'Repairs & Workshop',
    icon: Wrench,
    image: '/screenshots/repairs.png',
    tagline: 'Track repairs from intake to collection with status visibility, staff accountability, and customer updates built in.',
    benefit: 'No more lost jobs or constant status calls.',
    features: [
      'Digital intake with photos',
      'Customer notifications at each stage',
      'Deposit and balance tracking',
      'Overdue alerts',
    ],
  },
  {
    id: 'bespoke',
    title: 'Bespoke Commissions',
    icon: Gem,
    image: '/screenshots/bespoke.png',
    tagline: 'Run custom commissions with structured approvals, milestones, sourcing, and deposit tracking from brief to delivery.',
    benefit: 'Keep bespoke work controlled, visible, and professional.',
    features: [
      'Client approval gates',
      'Milestone-based deposit schedule',
      'Design brief and image storage',
      'Production timeline tracking',
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    icon: Package,
    image: '/screenshots/inventory.png',
    tagline: 'Track finished pieces, stones, metals, findings, and raw materials with live visibility and full provenance history.',
    benefit: 'See what you have, where it is, and what needs action.',
    features: [
      'Multi-category inventory management',
      'Barcode and SKU support',
      'Reorder alerts',
      'Multi-location stock visibility',
    ],
  },
  {
    id: 'customers',
    title: 'Customers',
    icon: Users,
    image: null,
    tagline: 'A jeweller-specific CRM that keeps purchase history, preferences, reminders, and client value in one place.',
    benefit: 'Turn one-off buyers into long-term clients.',
    features: [
      'Complete purchase and repair history',
      'VIP tags and custom fields',
      'Birthday and anniversary reminders',
      'Customer notes and communication log',
    ],
  },
  {
    id: 'invoices',
    title: 'Invoicing',
    icon: FileText,
    image: null,
    tagline: 'Create branded invoices, track balances, and connect payments directly to repairs and bespoke jobs.',
    benefit: 'Stay on top of cashflow without separate systems.',
    features: [
      'Professional invoice templates',
      'Partial payment and balance tracking',
      'Outstanding balance dashboard',
      'PDF generation and email delivery',
    ],
  },
  {
    id: 'suppliers',
    title: 'Suppliers',
    icon: Truck,
    image: null,
    tagline: 'Keep supplier records, purchase orders, receiving, and reconciliation connected to inventory.',
    benefit: 'Keep purchasing and stock movement connected.',
    features: [
      'Supplier directory with terms',
      'Purchase order creation and tracking',
      'Stock receiving and cost recording',
      'Supplier-linked inventory items',
    ],
  },
  {
    id: 'command-center',
    title: 'Command Centers',
    icon: LayoutGrid,
    image: null,
    tagline: 'Give every repair and bespoke job its own operational screen with status, documents, finances, and activity history in one place.',
    benefit: 'One screen for the entire job — not five disconnected tools.',
    features: [
      'Full job details and history in one screen',
      'Activity timeline of every action',
      'Live financial summary',
      'Linked photos and documents',
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics & Reporting',
    icon: BarChart3,
    image: '/screenshots/analytics.png',
    tagline: 'Track jewellery-specific performance across sales, stock, workshop throughput, and overdue balances.',
    benefit: 'Make decisions from jewellery metrics, not generic retail reports.',
    features: [
      'Sales by period, category, and staff',
      'Workshop throughput and completion rates',
      'Inventory turnover analysis',
      'Outstanding and overdue summary',
    ],
  },
]

export default function FeaturesClient() {
  const [activeIndex, setActiveIndex] = useState(0)
  const navRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const activeSection = sections[activeIndex]

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
            className="text-[0.8125rem] font-normal text-stone-400 tracking-wide text-center leading-relaxed"
          >
            Built for jewellers&nbsp;&nbsp;·&nbsp;&nbsp;9 connected modules&nbsp;&nbsp;·&nbsp;&nbsp;Repairs and bespoke built in&nbsp;&nbsp;·&nbsp;&nbsp;Guided migration included
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
                  className={`relative flex flex-col items-start gap-1 py-5 pr-10 lg:pr-14 cursor-pointer shrink-0 transition-all duration-300 ${
                    isActive ? 'opacity-100' : 'opacity-25 hover:opacity-60'
                  }`}
                >
                  <span className={`text-[0.625rem] font-mono tabular-nums tracking-[0.15em] transition-colors duration-300 ${isActive ? 'text-stone-500' : 'text-stone-400'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={`font-serif leading-none transition-all duration-300 ${isActive ? 'text-stone-900 text-base font-semibold' : 'text-stone-500 text-[0.9375rem] font-normal'}`}>
                    {s.title}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 h-[2.5px] bg-stone-900"
                      style={{ right: 'var(--tab-pr, 2.5rem)' }}
                      transition={{ duration: 0.35, ease: EASE }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tab content panel */}
      <div className="px-6 sm:px-10 lg:px-20 pt-8 pb-20 lg:pt-10 lg:pb-28">
        <div className="max-w-[1200px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: EASE }}
              className={`grid grid-cols-1 gap-10 lg:gap-14 items-start ${activeSection.image ? 'lg:grid-cols-2' : 'lg:grid-cols-1 max-w-[640px]'}`}
            >
              {/* Left: text */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  {(() => { const Icon = activeSection.icon; return <Icon size={18} strokeWidth={1.25} className="text-stone-400" /> })()}
                  <span className="text-xs tabular-nums text-stone-300 font-medium tracking-widest">
                    {String(activeIndex + 1).padStart(2, '0')}
                  </span>
                </div>
                <h2 className="font-serif text-3xl lg:text-[2.5rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-4">
                  {activeSection.title}
                </h2>
                <p className="text-[0.9375rem] leading-relaxed text-stone-500 mb-6">
                  {activeSection.tagline}
                </p>
                <p className="text-[0.875rem] font-medium text-stone-900 border-l-2 border-stone-900 pl-4 mb-8">
                  {activeSection.benefit}
                </p>
                <ul className="space-y-3">
                  {activeSection.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-[0.9375rem] text-stone-600">
                      <span className="mt-2 w-1 h-1 rounded-full bg-stone-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: product visual (only when available) */}
              {activeSection.image && (
                <div className="relative rounded-2xl overflow-hidden bg-stone-100 shadow-[0_4px_32px_rgba(0,0,0,0.08)]">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={activeSection.image}
                      src={activeSection.image}
                      alt={activeSection.title}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="w-full h-full object-cover object-top"
                      style={{ aspectRatio: '16/10' }}
                    />
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* CTA */}
      <section className="py-20 lg:py-36 px-6 sm:px-10 lg:px-20 text-center border-t border-black/[0.06]">
        <motion.h2
          {...fadeBlur}
          className="font-serif text-3xl sm:text-4xl lg:text-[3.75rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-4"
        >
          See how Nexpura fits your workflow
        </motion.h2>
        <motion.p
          {...fadeUp(0.1)}
          className="text-[0.9375rem] text-stone-500 mb-10 max-w-md mx-auto"
        >
          Explore the platform in a personalised walkthrough built around your business.
        </motion.p>
        <motion.div {...fadeUp(0.2)} className="flex flex-col sm:flex-row gap-4 items-center justify-center">
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
            See real workflows
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
