'use client'

import { motion } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ShoppingCart01Icon,
  UserGroupIcon,
  Analytics02Icon,
  GridViewIcon,
  FileAttachmentIcon,
  AiBrain01Icon,
} from '@hugeicons/core-free-icons'

const features = [
  {
    icon: ShoppingCart01Icon,
    title: 'Seamless POS',
    description:
      'Process sales, manage layaways, and handle returns with a system built for jewellery retail.',
  },
  {
    icon: UserGroupIcon,
    title: 'Client Intelligence',
    description:
      'Complete purchase history, preferences, and VIP tagging for every customer relationship.',
  },
  {
    icon: Analytics02Icon,
    title: 'Live Analytics',
    description:
      'Real-time dashboards for sales, inventory turnover, and workshop performance.',
  },
  {
    icon: GridViewIcon,
    title: 'Workshop Command',
    description:
      'Track every repair and commission from intake to collection with full visibility.',
  },
  {
    icon: FileAttachmentIcon,
    title: 'Auto-Generated Reports',
    description:
      'End-of-day summaries, financial reports, and inventory audits ready to share.',
  },
  {
    icon: AiBrain01Icon,
    title: 'Smart Insights',
    description:
      'AI that surfaces trends, flags slow-moving stock, and suggests reorder points.',
  },
]

/* ── Fake sparkline SVG ─────────────────────────────────────────────────── */
function MiniSparkline({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 24" className="w-full h-6 mt-1" fill="none">
      <path
        d={`M0 18 Q10 14 20 16 T40 10 T60 12 T80 4`}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
    </svg>
  )
}

/* ── Dashboard mockup component ─────────────────────────────────────────── */
function DashboardMockup() {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden select-none pointer-events-none">
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50/50">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
          <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
        </div>
        <div className="flex-1 mx-8">
          <div className="bg-stone-100 rounded-md h-5 max-w-[260px] mx-auto flex items-center justify-center">
            <span className="text-[9px] text-stone-400 font-medium">app.nexpura.com/dashboard</span>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-[180px] bg-[#1A1A1A] p-4 hidden sm:block shrink-0">
          <div className="font-serif text-white text-xs tracking-[0.12em] mb-6">NEXPURA</div>
          <div className="space-y-1">
            {['Dashboard', 'POS / Sales', 'Customers', 'Inventory', 'Invoices', 'Repairs', 'Bespoke'].map((item, i) => (
              <div
                key={item}
                className={`px-3 py-1.5 rounded text-[10px] font-medium ${
                  i === 0 ? 'bg-white/10 text-white' : 'text-stone-500'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 sm:p-5 bg-stone-50/50 min-h-[320px] sm:min-h-[380px]">
          {/* Header */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-stone-900">Good morning, Sarah</div>
            <div className="text-[10px] text-stone-400 mt-0.5">Maison Dubois · Monday, 29 March</div>
            <div className="flex gap-1.5 mt-2">
              {['New Sale', 'New Repair', 'New Job'].map((a) => (
                <div key={a} className="px-2.5 py-1 bg-white border border-stone-200 rounded text-[9px] font-medium text-stone-600">
                  {a}
                </div>
              ))}
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
            {[
              { label: 'Sales This Month', value: '$24,800', sub: '18 sales', color: '#b45309' },
              { label: 'Active Repairs', value: '12', sub: 'all on track', color: '#2563eb' },
              { label: 'Bespoke Jobs', value: '5', sub: 'in production', color: '#7c3aed' },
              { label: 'Outstanding', value: '$3,200', sub: '2 invoices', color: '#059669' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-lg border border-stone-200 p-3">
                <div className="text-[8px] font-medium text-stone-400 uppercase tracking-wider">{kpi.label}</div>
                <div className="text-base font-semibold text-stone-900 mt-0.5">{kpi.value}</div>
                <div className="text-[9px] text-stone-400">{kpi.sub}</div>
                <MiniSparkline color={kpi.color} />
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Bar chart */}
            <div className="col-span-2 bg-white rounded-lg border border-stone-200 p-3">
              <div className="text-[8px] font-medium text-stone-400 uppercase tracking-wider mb-2">Sales — Last 7 Days</div>
              <div className="flex items-end gap-1.5 h-16">
                {[40, 55, 35, 65, 80, 50, 70].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, backgroundColor: '#b45309', opacity: 0.7 + i * 0.04 }} />
                ))}
              </div>
              <div className="flex justify-between mt-1.5">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <span key={d} className="text-[7px] text-stone-400 flex-1 text-center">{d}</span>
                ))}
              </div>
            </div>

            {/* Repairs table mini */}
            <div className="bg-white rounded-lg border border-stone-200 p-3">
              <div className="text-[8px] font-medium text-stone-400 uppercase tracking-wider mb-2">Active Repairs</div>
              <div className="space-y-1.5">
                {[
                  { name: 'Gold Ring Resize', status: 'In Workshop', color: 'text-amber-700 bg-amber-50' },
                  { name: 'Diamond Reset', status: 'Ready', color: 'text-emerald-700 bg-emerald-50' },
                  { name: 'Chain Repair', status: 'Intake', color: 'text-stone-600 bg-stone-100' },
                  { name: 'Bracelet Polish', status: 'In Workshop', color: 'text-amber-700 bg-amber-50' },
                ].map((r) => (
                  <div key={r.name} className="flex items-center justify-between">
                    <span className="text-[9px] text-stone-700 font-medium truncate mr-2">{r.name}</span>
                    <span className={`text-[7px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${r.color}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingShowcase() {
  return (
    <section id="toolkit" className="py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-12 lg:mb-20"
        >
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 mb-3">
            The complete toolkit
          </h2>
          <p className="text-lg sm:text-xl lg:text-2xl text-stone-400 font-serif">
            for jewellers who move fast
          </p>
        </motion.div>

        {/* Dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative mb-16 lg:mb-24"
        >
          <DashboardMockup />
          {/* Bottom fade */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white via-white to-transparent rounded-b-2xl" />
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.1 + index * 0.05,
              }}
            >
              <div className="mb-4">
                <HugeiconsIcon icon={feature.icon} size={24} className="text-stone-500" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-lg lg:text-xl text-stone-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-stone-500 text-[0.9375rem] leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
