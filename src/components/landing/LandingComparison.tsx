const before = [
  'Inventory tracked in spreadsheets',
  'Generic POS not built for jewellery workflows',
  'Repairs managed in notebooks, paper, or messages',
  'No proper memo or consignment control',
  'No digital passport or authenticity record',
  'No structured bespoke workflow',
  'Limited visibility across jobs, stock, and team activity',
]

const after = [
  'Live inventory across pieces, stones, and components',
  'POS designed for jewellery retail',
  'Repair tracking with customer updates built in',
  'Memo and consignment tracking with return alerts',
  'QR-verifiable digital passports',
  'Structured bespoke workflow with milestone sign-off',
  'Jewellery-specific visibility across stock, jobs, and performance',
]

export default function LandingComparison() {
  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        <h2
          className="nx-fade-in-blur font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-16"
        >
          Built for jewellers — not just adapted for them
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div
            className="nx-fade-in bg-white border border-stone-100 rounded-2xl p-8"
          >
            <h3 className="text-[0.9375rem] font-medium text-stone-400 uppercase tracking-wider mb-6">
              What generic systems leave you with
            </h3>
            <ul className="space-y-3">
              {before.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[0.9375rem] text-stone-500">
                  <span className="mt-0.5 text-stone-300 shrink-0 leading-relaxed">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div
            style={{ animationDelay: '0.1s' }}
            className="nx-fade-in bg-stone-900 rounded-2xl p-8"
          >
            <h3 className="text-[0.9375rem] font-medium text-stone-400 uppercase tracking-wider mb-6">
              What Nexpura gives you instead
            </h3>
            <ul className="space-y-3">
              {after.map((item) => (
                <li key={item} className="flex items-start gap-3 text-[0.9375rem] text-stone-200">
                  <span className="mt-0.5 text-stone-400 shrink-0 leading-relaxed">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
