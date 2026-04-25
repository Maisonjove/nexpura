import SectionHeader from './ui/SectionHeader'

/**
 * "Built for jewellers — not just adapted for them" comparison per
 * Kaitlyn's brief (section 15). Left card muted ivory ("what you get
 * with generic"), right card charcoal with champagne checkmarks ("what
 * Nexpura gives you instead"). Right rows animate in with a stagger;
 * hovering a right row brightens its checkmark + adds a faint
 * champagne underline.
 */

const BEFORE = [
  'Inventory tracked in spreadsheets',
  'Generic POS not built for jewellery workflows',
  'Repairs managed in notebooks, paper, or messages',
  'No proper memo or consignment control',
  'No digital passport or authenticity record',
  'No structured bespoke workflow',
  'Limited visibility across jobs, stock, and team activity',
] as const

const AFTER = [
  'Live inventory across pieces, stones, and components',
  'POS designed for jewellery retail',
  'Repair tracking with customer updates built in',
  'Memo and consignment tracking with return alerts',
  'QR-verifiable digital passports',
  'Structured bespoke workflow with milestone sign-off',
  'Jewellery-specific visibility across stock, jobs, and performance',
] as const

export default function LandingComparison() {
  return (
    <section className="bg-m-ivory py-24 lg:py-32 px-6 sm:px-12">
      <div className="max-w-[1200px] mx-auto">
        <SectionHeader
          title="Built for jewellers — not just adapted for them"
          subtitle="Generic retail systems miss the workflows that make jewellery businesses complex. Nexpura is designed around repairs, bespoke orders, passports, inventory, and customer trust."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 mt-14">
          {/* Left card — muted ivory (the problem state) */}
          <div className="rounded-2xl bg-m-ivory border border-m-border-soft p-8 m-reveal">
            <h3 className="text-[12px] font-medium text-m-text-muted uppercase tracking-[0.15em] mb-6">
              What generic systems leave you with
            </h3>
            <ul className="space-y-3.5">
              {BEFORE.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-[15px] leading-[1.5] text-m-text-muted"
                >
                  <CrossIcon className="text-m-text-muted/60 shrink-0 mt-1" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right card — charcoal with champagne checks (the win state) */}
          <div
            className="relative rounded-2xl bg-m-charcoal border border-[rgba(201,169,97,0.2)] p-8 overflow-hidden m-reveal"
          >
            {/* Subtle champagne radial at top */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-[0.10]"
              style={{
                background:
                  'radial-gradient(ellipse at top, rgba(201,169,97,1) 0%, transparent 65%)',
              }}
            />
            <h3 className="relative text-[12px] font-medium text-m-champagne uppercase tracking-[0.15em] mb-6">
              What Nexpura gives you instead
            </h3>
            <ul className="relative space-y-3.5">
              {AFTER.map((item, i) => (
                <li
                  key={item}
                  className="m-reveal group flex items-start gap-3 text-[15px] leading-[1.5] text-white/90"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <CheckIcon className="text-m-champagne shrink-0 mt-[3px] transition-transform duration-200 [transition-timing-function:var(--m-ease)] group-hover:scale-110" />
                  <span className="relative">
                    {item}
                    <span
                      aria-hidden
                      className="absolute left-0 right-0 -bottom-0.5 h-px bg-m-champagne/40 origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100"
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M3 8.5L7 12.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <path d="M3 3L11 11M11 3L3 11" strokeLinecap="round" />
    </svg>
  )
}
