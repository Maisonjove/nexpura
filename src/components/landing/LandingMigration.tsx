import Link from 'next/link'

const steps = [
  {
    n: '01',
    title: 'We review your current setup',
    body: 'We assess your tools, workflows, and what needs to carry across.',
  },
  {
    n: '02',
    title: 'We migrate your data',
    body: 'Customers, stock, repair history, supplier records, and key business data are brought across carefully.',
  },
  {
    n: '03',
    title: 'We train your team',
    body: 'Live onboarding, walkthroughs, and support to help your team get comfortable fast.',
  },
]

export default function LandingMigration() {
  return (
    <section id="migration" className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        <h2
          className="nx-fade-in-blur font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-4"
        >
          Switch without the stress
        </h2>
        <p
          style={{ animationDelay: '0.1s' }}
          className="nx-fade-in text-center text-stone-500 text-[0.9375rem] mb-16 max-w-xl mx-auto"
        >
          We guide the move from your current setup to Nexpura with migration, onboarding, and practical support from day one.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {steps.map((step, i) => (
            <div
              key={step.n}
              style={{ animationDelay: `${i * 0.1}s` }}
              className="nx-fade-in-up border border-stone-100 rounded-2xl p-8"
            >
              <span className="text-xs tabular-nums text-stone-300 font-medium block mb-4">{step.n}</span>
              <h3 className="font-serif text-xl text-stone-900 mb-3">{step.title}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-stone-500">{step.body}</p>
            </div>
          ))}
        </div>
        <div
          style={{ animationDelay: '0.3s' }}
          className="nx-fade-in-up bg-stone-50 border border-stone-100 rounded-2xl p-8 text-center mb-10"
        >
          <p className="font-serif text-xl text-stone-900">
            Guided migration included with every plan · No setup fees · No unnecessary downtime
          </p>
        </div>
        <div
          style={{ animationDelay: '0.4s' }}
          className="nx-fade-in text-center"
        >
          <Link
            href="/contact"
            className="inline-flex items-center justify-center min-w-[180px] px-10 py-4 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] relative overflow-hidden transition-shadow duration-400"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
            <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">Book a Demo</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
