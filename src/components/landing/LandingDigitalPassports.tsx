import Image from 'next/image'

const benefits = [
  'Instant customer verification',
  'Piece-level provenance history',
  'Better trust at point of sale',
  'Stronger resale and aftercare confidence',
]

export default function LandingDigitalPassports() {
  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <h2
            className="nx-fade-in-blur font-serif text-3xl sm:text-4xl lg:text-[2.75rem] font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 mb-6"
          >
            Authenticity, provenance, and trust — attached to every piece
          </h2>
          <p
            style={{ animationDelay: '0.1s' }}
            className="nx-fade-in text-stone-500 text-[0.9375rem] leading-relaxed mb-4"
          >
            When a customer buys from you, they should know exactly what they own.
          </p>
          <p
            style={{ animationDelay: '0.15s' }}
            className="nx-fade-in text-stone-500 text-[0.9375rem] leading-relaxed mb-8"
          >
            Nexpura generates a digital passport for every eligible piece, linked by QR code to a verified record of materials, craftsmanship, and provenance.
          </p>
          <ul className="space-y-3">
            {benefits.map((b, i) => (
              <li
                key={b}
                style={{ animationDelay: `${0.2 + i * 0.07}s` }}
                className="nx-fade-in flex items-start gap-3 text-[0.9375rem] text-stone-600 leading-relaxed"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div
          style={{ animationDelay: '0.2s' }}
          className="nx-fade-in-blur relative rounded-2xl overflow-hidden shadow-xl"
        >
          <Image
            src="/screenshots/passport.png"
            alt="Nexpura Digital Passport - Item Specifications"
            width={800}
            height={600}
            className="w-full h-auto"
          />
        </div>
      </div>
    </section>
  )
}
