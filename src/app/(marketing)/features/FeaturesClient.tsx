'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
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

const heroFadeBlur = {
  initial: { opacity: 0, filter: 'blur(6px)' },
  animate: { opacity: 1, filter: 'blur(0px)' },
  transition: { duration: 1.2, ease: EASE },
}

const heroFadeUp = (delay = 0) => ({
  initial: { opacity: 0, filter: 'blur(4px)', y: 16 },
  animate: { opacity: 1, filter: 'blur(0px)', y: 0 },
  transition: { duration: 1.2, ease: EASE, delay },
})

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
  { id: 'pos', title: 'Point of Sale', icon: ShoppingBag, tagline: 'A fast, intuitive POS designed for the jewellery shop floor.', features: ['Fast barcode and SKU scanning', 'Layby and payment plan support','Gift voucher creation and redemption','Multiple payment methods, split tender','Automatic customer creation from sale','Real-time inventory deduction','Receipt printing and email delivery','End-of-day cash reconciliation'] },
  { id: 'repairs', title: 'Repairs & Workshop', icon: Wrench, tagline: 'Complete repair management from the first phone call to collection.', features: ['Digital intake with photos','Stage-by-stage workflow','Customer notifications at each stage','Labour and material cost tracking','Repair deposit and balance management','Overdue alerts on the dashboard','Repair number sequencing and labels','Batch printing of repair tags'] },
  { id: 'bespoke', title: 'Bespoke Commissions', icon: Gem, tagline: 'Manage custom jewellery commissions from concept to delivery.', features: ['Commission-specific workflow and stages','Design brief and reference image storage','Client approval gates','Material specifications and stone requirements','Milestone-based deposit schedules','Production timeline tracking','Communication log with client','Handover and certificate management'] },
  { id: 'inventory', title: 'Inventory', icon: Package, tagline: 'Full stock control across finished pieces, loose stones, metals, findings, and raw materials.', features: ['Multi-category inventory management','SKU and barcode management','Reorder level alerts','Stock take and variance tracking','Multi-location stock with transfers','Supplier linkage per item','Full provenance and cost history','Batch import from spreadsheets'] },
  { id: 'customers', title: 'Customers', icon: Users, tagline: 'A CRM built for jewellers. Know your customers.', features: ['Complete purchase and repair history','VIP tagging and custom tags','Birthday and anniversary reminders','Customer notes and communication log','Email campaigns and follow-ups','Customer lifetime value reporting','Import existing customer lists','Merge duplicate customer records'] },
  { id: 'invoices', title: 'Invoicing', icon: FileText, tagline: "Professional invoices that reflect your brand.", features: ['Professional invoice templates','Partial payment and balance tracking','Payment due date and overdue alerts','PDF generation and email delivery','GST / VAT / tax handling','Linked to repairs and bespoke jobs','Outstanding balance dashboard','Xero and accounting export'] },
  { id: 'suppliers', title: 'Suppliers', icon: Truck, tagline: 'Manage your supplier relationships, purchase orders, and stock receiving in one place.', features: ['Supplier directory with terms','Purchase order creation and tracking','Stock receiving and cost recording','Supplier-linked inventory items','Outstanding purchase order tracking','Supplier invoice reconciliation'] },
  { id: 'command-center', title: 'Command Centers', icon: LayoutGrid, tagline: 'The flagship Nexpura feature. Every repair and bespoke job gets its own dedicated operational screen.', features: ['Full job details and history in one screen','Real-time financial summary','Stage action buttons with notifications','Line items, labour, and materials breakdown','Activity timeline of every action','Customer communication history','Payment recording with partial support','Linked photos and documents'] },
  { id: 'analytics', title: 'Analytics & Reporting', icon: BarChart3, tagline: 'Understand your business with reports designed around jewellery metrics.', features: ['Sales by period, category, and staff','Workshop throughput and completion rates','Customer acquisition and retention metrics','Outstanding and overdue summary','Inventory turnover analysis','End-of-day and period closing reports','Exportable to CSV for accountants'] },
]

export default function FeaturesClient() {
  const [activeId, setActiveId] = useState<string>(sections[0].id)
  const navRef = useRef<HTMLDvElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({})
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 })

  const scrollToHash = (hash: string, smooth = true) => {
    if (!sections.find((s) => s.id === hash)) return
    setActiveId(hash)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(hash)
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY - 144 - 80
      window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
    }))
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.replace('#', '')
    if (hash) scrollToHash(hash)
  }, [])

  useEffect(() => {
    const onHashChange = () => { const h = window.location.hash.replace('#', ''); if (h) scrollToHash(h) }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (!el) return
      const obs = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) setActiveId(s.id) }) }, { rootMargin: '-25% 0px -45% 0px', threshold: 0 })
      obs.observe(el); observers.push(obs)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [])

  useEffect(() => {
    const updateIndicator = () => {
      const el = itemRefs.current[activeId]; const list = listRef.current; const nav = navRef.current
      if (!el || !list || !nav) return
      const elR = el.getBoundingClientRect(); const lR = list.getBoundingClientRect()
      setIndicator({ left: elR.left - lR.left, width: elR.width })
      const nR = nav.getBoundingClientRect()
      nav.scrollTo({ left: elR.left - nR.left + nav.scrollLeft - nR.width / 2 + elR.width / 2, behavior: 'smooth' })
    }
    updateIndicator(); window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [activeId])

  return (
    <div className="bg-white">
      <section className="pt-20 pb-20 lg:pt-28 lg:pb-28 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p {...heroFadeUp()} className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-6">The Platform</motion.p>
          <motion.h1 {...heroFadeBlur} className="font-serif text-4xl sm:text-5xl lg:text-[clamp(2.75rem,5vw,4.25rem)] font-normal leading-[1.15] tracking-[-0.01em] text-stone-900 mb-7">Every feature, <em className="italic">crafted for jewellers</em></motion.h1>
          <motion.p {...heroFadeUp(0.3)} className="text-base lg:text-lg leading-relaxed text-stone-500 max-w-[600px] mx-auto">Nexpura covers the full spectrum of jewellery business operations — from the shop floor to the workshop, from customer relationships to financial management.</motion.p>
        </div>
      </section>
      <div className="sticky top-[72px] z-30 bg-white/95 backdrop-blur-xl border-y border-black/[0.06]">
        <div ref={navRef} className="max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-20 overflow-x-auto scrollbar-none relative" style={{ scrollbarWidth: 'none' }}>
          <div ref={listRef} className="flex items-end gap-10 lg:gap-14 py-5 whitespace-nowrap relative">
            {sections.map((s, i) => {
              const isActive = activeId === s.id
              return (
                <a key={s.id} href={`#${s.id}`} ref={(el) => { itemRefs.current[s.id] = el }} onClick={(e) => { e.preventDefault(); scrollToHash(s.id); history.replaceState(null, '', `#${s.id}`) }} className="group relative flex flex-col items-start gap-1 py-1 transition-opacity duration-500">
                  <span className={`text-[0.625rem] font-mono tabular-nums tracking-[0.15em] transition-colors duration-500 ${isActive ? 'text-stone-900' : 'text-stone-300 group-hover:text-stone-500'}`}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={`font-serif text-[0.9375rem] lg:text-base leading-none transition-colors duration-500 ${isActive ? 'text-stone-900' : 'text-stone-400 group-hover:text-stone-700'}`}>{s.title}</span>
                </a>
              )
            })}
            <motion.div aria-hidden className="absolute bottom-0 h-px bg-stone-900" animate={{ left: indicator.left, width: indicator.width }} transition={{ duration: 0.6, ease: EASE }} />
          </div>
        </div>
      </div>
      <div className="px-6 sm:px-10 lg:px-20">
        <div className="max-w-[1200px] mx-auto py-20 lg:py-32 space-y-24 lg:space-y-32">
          {sections.map((section, index) => {
            const Icon = section.icon
            return (
              <section key={section.id} id={section.id} className="scroll-mt-52 lg:scroll-mt-56 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
                <div className="lg:col-span-5">
                  <motion.div {...fadeUp()} className="flex items-center gap-4 mb-6"><Icon size={28} strokeWidth={1.25} className="text-stone-900" /><span className="text-sm tabular-nums text-stone-300 font-medium">{String(index + 1).padStart(2, '0')}</span></motion.div>
                  <motion.h2 {...fadeBlur} className="font-serif text-3xl lg:text-[2.5rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-5">{section.title}</motion.h2>
                  <motion.p {...fadeUp(0.1)} className="text-[0.9375rem] lg:text-base leading-relaxed text-stone-500">{section.tagline}</motion.p>
                </div>
                <motion.ul {...fadeUp(0.15)} className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 self-start">
                  {section.features.map((f) => (<li key={f} className="flex items-start gap-3 text-[0.9375rem] text-stone-700 border-b border-stone-100 pb-4"><span className="mt-2 w-1 h-1 rounded-full bg-stone-900 flex-shrink-0" />{f}</li>))}
                </motion.ul>
              </section>
            )
          })}
        </div>
      </div>
      <section className="py-20 lg:py-36 px-6 sm:px-10 lg:px-20 text-center border-t border-black/[0.06]">
        <motion.h2 {...fadeBlur} className="font-serif text-3xl sm:text-4xl lg:text-[3.75rem] font-normal leading-[1.12] tracking-[-0.01em] text-stone-900 mb-10 italic">See it in action.</motion.h2>
        <motion.div {...fadeUp(0.1)} className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link href="/signup" className="inline-flex items-center justify-center min-w-[180px] px-10 py-4 md:min-w-[200px] md:px-12 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] transition-shadow duration-400 hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] relative overflow-hidden cursor-pointer"><span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" /><span className="text-base font-medium text-white tracking-[0.01em] relative z-10">Start Free Trial</span></Link>
          <Link href="/contact" className="text-[0.9375rem] text-stone-700 underline underline-offset-4 hover:opacity-60 transition-opacity duration-300">Book a demo</Link>
        </motion.div>
      </section>
    </div>
  )
}
