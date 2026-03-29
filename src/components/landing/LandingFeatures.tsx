'use client'

import { motion } from 'framer-motion'

const features = [
  {
    title: 'Seamless POS',
    description:
      'Effortless management for boutique sales, integrating inventory and client profiles for a superior in-store experience.',
    image: '/features/pos.png',
  },
  {
    title: 'Bespoke Orders',
    description:
      'Track custom designs from initial sketch to final delivery, ensuring every client vision is realized perfectly.',
    image: '/features/bespoke.png',
  },
  {
    title: 'Workshop Hub',
    description:
      'Streamline materials management and artisan workflow for increased efficiency and precision in every piece.',
    image: '/features/workshop.png',
  },
]

export default function LandingFeatures() {
  return (
    <section className="bg-white py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <motion.h2
        initial={{ opacity: 0, filter: 'blur(6px)' }}
        whileInView={{ opacity: 1, filter: 'blur(0px)' }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-12 lg:mb-20"
      >
        Every facet of your business, mastered.
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-6 lg:gap-12 max-w-[1200px] mx-auto">
        {features.map((feature, index) => (
          <div key={feature.title} className="flex flex-col">
            <motion.h3
              initial={{ opacity: 0, filter: 'blur(4px)', y: 16 }}
              whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: index * 0.1 }}
              className="font-serif text-xl lg:text-2xl font-normal text-stone-900 mb-3"
            >
              {feature.title}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, filter: 'blur(4px)', y: 16 }}
              whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 + index * 0.1 }}
              className="text-[0.9375rem] leading-relaxed text-stone-500 mb-6"
            >
              {feature.description}
            </motion.p>
            <div className="relative aspect-square rounded-sm overflow-hidden mt-auto">
              <img
                src={feature.image}
                alt={feature.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
