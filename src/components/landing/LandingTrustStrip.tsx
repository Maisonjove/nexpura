/**
 * Trust strip per Kaitlyn's brief (section 6).
 *
 * A thin horizontal strip directly under the hero, ivory background,
 * top + bottom 1px borders. Four items separated by thin vertical
 * dividers on desktop; 2x2 grid on mobile. Subtle one-time fade-in on
 * scroll into view (handled by `.m-reveal` + IntersectionObserver in
 * marketing-reveal.ts mounted on the page root).
 */

const ITEMS = [
  'Built for jewellery workflows',
  'Free guided migration',
  'No hidden fees',
  '14-day free trial',
] as const

export default function LandingTrustStrip() {
  return (
    <section
      aria-label="Why jewellers choose Nexpura"
      className="bg-m-ivory border-y border-m-border-soft m-reveal"
    >
      <div className="max-w-[1200px] mx-auto px-6 sm:px-12">
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 sm:divide-x sm:divide-m-border-soft py-5 sm:py-0 sm:h-16 sm:items-center">
          {ITEMS.map((item) => (
            <li
              key={item}
              className="text-center text-[13px] sm:text-[14px] font-sans tracking-[0.04em] text-m-text-secondary sm:px-4"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
