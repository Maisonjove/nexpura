import Link from 'next/link'

const steps = [
  { n: '1', title: 'Personalised walkthrough', body: 'We show the modules that matter most to your business.' },
  { n: '2', title: 'Migration discussion', body: 'We review your current tools and outline an import plan.' },
  { n: '3', title: 'Workflow review', body: 'We map your repair, bespoke, and sales workflows to Nexpura.' },
  { n: '4', title: 'Setup recommendations', body: 'You get a recommended configuration before you commit.' },
  { n: '5', title: 'Q&A', body: 'Ask anything. Clear answers, no pressure.' },
]

export default function LandingDemoExplainer() {
  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[700px] mx-auto text-center">
        <h2
          className="nx-fade-in-blur font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 mb-4"
        >
          What happens in a demo
        </h2>
        <p
          style={{ animationDelay: '0.1s' }}
          className="nx-fade-in text-stone-500 text-[0.9375rem] mb-14"
        >
          Book 30 minutes and we'll show you exactly how Nexpura fits your business.
        </p>
        <div className="text-left space-y-0 mb-14">
          {steps.map((step, i) => (
            <div
              key={step.n}
              style={{ animationDelay: `${i * 0.08}s` }}
              className="nx-fade-in-up flex gap-6 py-4 border-b border-stone-100 last:border-b-0"
            >
              <span className="text-[0.625rem] font-mono tabular-nums tracking-[0.15em] text-stone-300 pt-1 shrink-0 w-6">{step.n}</span>
              <div>
                <h3 className="font-serif text-lg text-stone-900 mb-1">{step.title}</h3>
                <p className="text-[0.9375rem] text-stone-500 leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div
          style={{ animationDelay: '0.4s' }}
          className="nx-fade-in-up flex flex-col sm:flex-row gap-4 items-center"
        >
          <Link
            href="/contact"
            className="inline-flex items-center justify-center min-w-[180px] px-10 py-4 bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] relative overflow-hidden transition-shadow duration-400"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
            <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">Book a Demo</span>
          </Link>
          <Link
            href="/contact"
            className="text-[0.9375rem] text-stone-700 underline underline-offset-4 hover:opacity-60 transition-opacity duration-300"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  )
}
