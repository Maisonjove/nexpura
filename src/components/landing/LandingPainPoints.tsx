const pains = [
  { title: 'Repairs fall through the cracks', body: 'Jobs get lost. Customers call chasing. Staff scramble.' },
  { title: 'No real stock visibility', body: 'You find out something is sold out only when it becomes a problem.' },
  { title: 'Bespoke and repairs live across too many tools', body: 'Quotes in email, job notes in notebooks, updates in messages.' },
  { title: 'Customers keep chasing updates', body: 'Without live status, every job creates more calls and confusion.' },
]

export default function LandingPainPoints() {
  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        <h2
          className="nx-fade-in-blur font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-16"
        >
          Sound familiar?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {pains.map((pain, i) => (
            <div
              key={pain.title}
              style={{ animationDelay: `${i * 0.07}s` }}
              className="nx-fade-in-up border border-stone-100 rounded-2xl p-7"
            >
              <h3 className="font-serif text-lg text-stone-900 mb-2">{pain.title}</h3>
              <p className="text-[0.9375rem] text-stone-400 leading-relaxed">{pain.body}</p>
            </div>
          ))}
        </div>
        <p
          style={{ animationDelay: '0.3s' }}
          className="nx-fade-in text-center font-serif text-xl sm:text-2xl text-stone-900"
        >
          Nexpura brings every workflow into one place — so nothing gets lost, delayed, or disconnected.
        </p>
      </div>
    </section>
  )
}
