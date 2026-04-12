'use client'
import { motion } from 'framer-motion'

const testimonials = [
  {
    quote: "We replaced three tools with Nexpura and haven't looked back. Repairs, POS, and client tracking are all in one place now.",
    name: 'Sarah M.',
    role: 'Owner',
    business: 'The Gem Room',
    city: 'Melbourne',
    type: 'Independent Boutique',
    result: 'Went from 3 systems to 1',
  },
  {
    quote: "The bespoke workflow is exactly how we work. Clients love getting live updates. It's changed our whole process.",
    name: 'James T.',
    role: 'Head Jeweller',
    business: 'Thornton Atelier',
    city: 'Sydney',
    type: 'Bespoke Studio',
    result: 'Client communication 100% improved',
  },
  {
    quote: "Multi-store was our biggest problem. Now our whole team sees the same stock in real time.",
    name: 'Nina K.',
    role: 'Director',
    business: 'Aurantia Jewellery',
    city: 'Auckland',
    type: 'Multi-Store Group',
    result: 'Eliminated stock discrepancies overnight',
  },
]

export default function LandingTestimonialsExpanded() {
  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[1200px] mx-auto">
        <motion.h2
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-16"
        >
          What jewellers say.
        </motion.h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: i * 0.1 }}
              className="border border-stone-100 rounded-2xl p-8 flex flex-col"
            >
              <blockquote className="font-serif text-lg text-stone-900 leading-[1.5] mb-6 flex-1">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div>
                <p className="text-[0.9375rem] font-semibold text-stone-900">{t.name} · {t.role}</p>
                <p className="text-[0.875rem] text-stone-500">{t.business}, {t.city}</p>
                <p className="text-[0.875rem] text-stone-400 mt-1">{t.type}</p>
                <p className="text-[0.8125rem] text-stone-400 italic mt-2">&ldquo;{t.result}&rdquo;</p>
                <p className="text-[0.6875rem] text-stone-300 mt-3">Placeholder — replace with real client quote</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
