import Image from 'next/image'

const points = [
  'Log item details, photos, pricing, and due date at intake',
  'Assign work clearly to the right staff member',
  'Share live status updates without the calls',
  'Track deposits, balances, and collection readiness',
  'See all open jobs, priorities, and deadlines in one view',
]

export default function LandingRepairs() {
  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <h2
            className="nx-fade-in-blur font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 mb-6"
          >
            The repair workflow your customers can actually follow
          </h2>
          <p
            style={{ animationDelay: '0.1s' }}
            className="nx-fade-in text-stone-500 text-[0.9375rem] leading-relaxed mb-8"
          >
            Every repair is logged, assigned, tracked, and updated in one place — from intake to collection.
          </p>
          <ul className="space-y-4">
            {points.map((point, i) => (
              <li
                key={i}
                style={{ animationDelay: `${0.15 + i * 0.07}s` }}
                className="nx-fade-in flex items-start gap-3 text-[0.9375rem] text-stone-600 leading-relaxed"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div
          style={{ animationDelay: '0.2s' }}
          className="nx-fade-in-blur relative rounded-2xl overflow-hidden shadow-xl"
        >
          <Image
            src="/screenshots/repairs.png"
            alt="Nexpura Repair Tracker"
            width={800}
            height={500}
            className="w-full h-auto"
          />
        </div>
      </div>
    </section>
  )
}
