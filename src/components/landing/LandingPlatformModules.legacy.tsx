import SectionHeader from './ui/SectionHeader'

/**
 * Platform modules grid per Kaitlyn's brief (section 10). 10 modules,
 * 5×2 desktop / 2 cols mobile. Each card: champagne 12px number,
 * minimal icon, serif title, one-line body. Hover: lift 4px + champagne
 * border + warm tint + arrow → appears in top-right.
 */

interface Module {
  n: string
  title: string
  body: string
}

const MODULES: readonly Module[] = [
  { n: '01', title: 'POS', body: 'Process jewellery sales with connected customer, stock, and repair data.' },
  { n: '02', title: 'Inventory', body: 'Track pieces, stones, metals, components, status, location, and movement history.' },
  { n: '03', title: 'Repairs', body: 'Log, assign, update, and close repair jobs from intake to collection.' },
  { n: '04', title: 'Bespoke Orders', body: 'Manage custom jobs with approvals, milestones, deposits, sourcing, and production notes.' },
  { n: '05', title: 'CRM', body: 'Keep customer profiles, purchase history, preferences, and service records connected.' },
  { n: '06', title: 'Invoicing', body: 'Generate invoices, receipts, balances, and supplier billing in one place.' },
  { n: '07', title: 'Analytics', body: 'Track sales, workshop, and stock performance through clear reporting.' },
  { n: '08', title: 'Digital Passports', body: 'Attach authenticity, provenance, materials, and service history to each piece.' },
  { n: '09', title: 'Memo & Consignment', body: 'Track loaned pieces, returns, and commission splits clearly.' },
  { n: '10', title: 'AI Copilot', body: 'Ask questions about your business and surface insights across stock, sales, jobs, and performance.' },
] as const

export default function LandingPlatformModules() {
  return (
    <section className="bg-white py-24 lg:py-32 px-6 sm:px-12">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeader
          title="One platform. Every jewellery workflow connected."
          subtitle="From the shop floor to the workshop, Nexpura connects the workflows generic retail systems leave scattered."
        />

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mt-14">
          {MODULES.map((mod, i) => (
            <article
              key={mod.n}
              className="m-reveal group relative bg-m-white-soft border border-m-border-soft rounded-2xl p-5 lg:p-6 transition-all duration-[250ms] [transition-timing-function:var(--m-ease)] hover:-translate-y-1 hover:border-m-border-hover hover:bg-[#FDFAF4] hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <span className="block text-[12px] tabular-nums font-medium text-m-champagne mb-3 transition-opacity duration-200 group-hover:opacity-100">
                {mod.n}
              </span>
              <h3 className="font-serif text-[18px] text-m-charcoal leading-[1.2]">
                {mod.title}
              </h3>
              <p className="mt-2 text-[13px] leading-[1.5] text-m-text-secondary">
                {mod.body}
              </p>

              {/* Arrow that slides in from the left on hover */}
              <span
                aria-hidden
                className="absolute top-5 right-5 text-m-charcoal opacity-0 -translate-x-2 transition-all duration-200 [transition-timing-function:var(--m-ease)] group-hover:opacity-100 group-hover:translate-x-0"
              >
                →
              </span>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
