import Button from './ui/Button'
import SectionHeader from './ui/SectionHeader'
import Card from './ui/Card'

/**
 * "Choose how you want to explore Nexpura" — replaces the prior
 * "What happens in a demo" timeline per Kaitlyn's brief (section 16).
 *
 * Two cards side-by-side. Card 1 (Free Trial) is visually stronger:
 * charcoal background, faint champagne corner accent, scaled slightly.
 * Card 2 (Demo) is the secondary ivory variant.
 *
 * Stack on mobile with the Free Trial card first (winning side leads).
 */
export default function LandingDemoExplainer() {
  return (
    <section className="bg-white py-20 lg:py-32 px-6 sm:px-12">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeader
          title="Choose how you want to explore Nexpura"
          subtitle="Start with the platform yourself, or book a guided walkthrough if you want help mapping Nexpura to your business."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 mt-14 max-w-[960px] mx-auto">
          {/* Card 1 — Free Trial (prominent) */}
          <Card variant="dark" className="relative lg:scale-[1.02] flex flex-col">
            <div
              aria-hidden
              className="absolute top-0 right-0 w-32 h-32 rounded-tr-2xl pointer-events-none opacity-30"
              style={{
                background:
                  'radial-gradient(circle at top right, rgba(201,169,97,0.25), transparent 70%)',
              }}
            />
            <h3 className="relative font-serif text-[28px] leading-[1.15] text-white">
              Start Free Trial
            </h3>
            <p className="relative mt-4 text-[15px] leading-[1.6] text-white/80">
              Explore Nexpura at your own pace and see how repairs, inventory, bespoke orders, passports, and customer records connect.
            </p>
            <ul className="relative mt-6 mb-8 space-y-2.5 text-[14px] text-white/85">
              {[
                '14-day free trial',
                'No charge today',
                'Cancel anytime before your trial ends',
                'Explore core workflows',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckIcon className="text-m-champagne shrink-0 mt-[3px]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="relative mt-auto">
              <Button
                href="/signup"
                fullWidth
                className="!bg-white !text-m-charcoal hover:!bg-white/90"
              >
                Start Free Trial
              </Button>
            </div>
          </Card>

          {/* Card 2 — Book a Demo (secondary) */}
          <Card variant="default" className="flex flex-col">
            <h3 className="font-serif text-[28px] leading-[1.15] text-m-charcoal">
              Book a Guided Demo
            </h3>
            <p className="mt-4 text-[15px] leading-[1.6] text-m-text-secondary">
              Walk through the platform with the Nexpura team and see how it can fit your current workflows.
            </p>
            <ul className="mt-6 mb-8 space-y-2.5 text-[14px] text-m-text-secondary">
              {[
                'Personalised walkthrough',
                'Workflow review',
                'Migration discussion',
                'Q&A',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="w-1.5 h-1.5 rounded-full bg-m-charcoal shrink-0 mt-2"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              <Button href="/contact" variant="secondary" fullWidth>
                Book a Guided Demo
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M3.5 8L7 11.5L12.5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
