'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'

const modules = [
  { n: '01', title: 'POS', desc: 'Fast, flexible point of sale built for jewellery retail.' },
  { n: '02', title: 'Inventory', desc: 'Live stock across items, stones, metals, and components.' },
  { n: '03', title: 'Repairs', desc: 'Full job tracking from intake to collection.' },
  { n: '04', title: 'Bespoke Orders', desc: 'Structured custom order workflow with client sign-off at every milestone.' },
  { n: '05', title: 'CRM', desc: 'Complete client profiles, purchase history, VIP tags, and birthdays.' },
  { n: '06', title: 'Invoicing', desc: 'Auto-generated invoices, receipts, and supplier billing.' },
  { n: '07', title: 'Analytics', desc: 'Sales dashboards, stock turnover, and workshop KPIs.' },
  { n: '08', title: 'Digital Passports', desc: 'QR code verified authenticity certificates for every piece you sell.' },
  { n: '09', title: 'Memo & Consignment', desc: 'Track loaned pieces, return dates, and commission splits.' },
  { n: '10', title: 'AI Copilot', desc: 'Ask anything about your business in plain English.' },
]

export default function LandingPlatformModules() {
  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        <motion.h2
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-4"
        >
          One platform. Ten modules.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, delay: 0.1 }}
          className="text-center text-stone-500 text-[0.9375rem] mb-16 max-w-xl mx-auto"
        >
          Every tool your jewellery business needs, connected and talking to each other.
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
              className="border border-stone-100 rounded-xl p-5"
            >
              <span className="text-xs tabular-nums text-stone-300 font-medium block mb-2">{mod.n}</span>
              <h3 className="font-serif text-base text-stone-900 mb-1.5">{mod.title}</h3>
              <p className="text-xs leading-relaxed text-stone-400">{mod.desc}</p>
            </motion.div>
          ))}
        </div>
        <div className="text-center">
          <Link
            href="/features"
            className="text-[0.9375rem] text-stone-600 underline underline-offset-4 hover:text-stone-900 transition-colors duration-200"
          >
            See all features →
          </Link>
        </div>
      </div>
    </section>
  )
}
