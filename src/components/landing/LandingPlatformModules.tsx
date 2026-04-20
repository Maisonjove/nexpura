const modules = [
  { n: '01', title: 'POS', desc: 'Fast checkout built for jewellery retail' },
  { n: '02', title: 'Inventory', desc: 'Live stock across pieces, stones, metals, and components' },
  { n: '03', title: 'Repairs', desc: 'Full job tracking from intake to collection' },
  { n: '04', title: 'Bespoke Orders', desc: 'Structured custom workflows with sign-off at key milestones' },
  { n: '05', title: 'CRM', desc: 'Client profiles, purchase history, reminders, and VIP tags' },
  { n: '06', title: 'Invoicing', desc: 'Invoices, receipts, balances, and supplier billing' },
  { n: '07', title: 'Analytics', desc: 'Sales, workshop, and stock performance in one view' },
  { n: '08', title: 'Digital Passports', desc: 'QR-verifiable authenticity and provenance records' },
  { n: '09', title: 'Memo & Consignment', desc: 'Loaned pieces, returns, and commission splits tracked clearly' },
  { n: '10', title: 'AI Copilot', desc: 'Ask questions about your business in plain English' },
]

export default function LandingPlatformModules() {
  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        <h2
          className="nx-fade-in-blur font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-4"
        >
          One platform. Every jewellery workflow connected.
        </h2>
        <p
          style={{ animationDelay: '0.1s' }}
          className="nx-fade-in text-center text-stone-500 text-[0.9375rem] mb-16 max-w-xl mx-auto"
        >
          From the shop floor to the workshop, Nexpura connects the workflows generic retail systems leave scattered.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
          {modules.map((mod, i) => (
            <div
              key={mod.n}
              style={{ animationDelay: `${i * 0.05}s` }}
              className="nx-fade-in-up border border-stone-200 rounded-xl p-5 hover:border-stone-300 hover:shadow-sm transition-all duration-200"
            >
              <span className="text-xs tabular-nums text-stone-300 font-medium block mb-3">{mod.n}</span>
              <h3 className="font-serif text-base text-stone-900 mb-1.5">{mod.title}</h3>
              <p className="text-xs leading-relaxed text-stone-400">{mod.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
