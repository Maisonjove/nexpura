'use client'
import { motion } from 'framer-motion'

const faqs = [
  {
    q: 'How long does migration take?',
    a: 'Most businesses are up and running quickly. Timelines vary depending on the size of your operation and how much data needs to carry across. We handle the process and keep you informed throughout.',
  },
  {
    q: 'Is migration free?',
    a: 'Yes. Free migration is included with every plan. No setup fees, no data loss, no downtime.',
  },
  {
    q: 'Can Nexpura replace my current POS?',
    a: 'Yes. Nexpura is a full POS system designed specifically for jewellery retail. It replaces general-purpose POS tools and spreadsheets.',
  },
  {
    q: 'Does it support repair job tracking?',
    a: 'Fully. Every repair can be logged, assigned, tracked, and communicated to the customer with live status links.',
  },
  {
    q: 'Can I track bespoke orders?',
    a: 'Yes. There is a full bespoke workflow covering initial consultation, stone sourcing, design approval, setting, polish, and delivery.',
  },
]

export default function LandingFaq() {
  return (
    <section className="bg-stone-50 py-20 lg:py-36 px-6 sm:px-10 lg:px-20">
      <div className="max-w-[800px] mx-auto">
        <motion.h2
          initial={{ opacity: 0, filter: 'blur(6px)' }}
          whileInView={{ opacity: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.1] tracking-[-0.01em] text-stone-900 text-center mb-16"
        >
          Questions About Switching to Nexpura
        </motion.h2>
        <div>
          {faqs.map((faq, i) => (
            <motion.div
              key={faq.q}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: i * 0.06 }}
              className="py-7 border-b border-stone-200 first:border-t first:border-stone-200"
            >
              <h3 className="font-serif text-lg text-stone-900 mb-2">{faq.q}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-stone-500">{faq.a}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
