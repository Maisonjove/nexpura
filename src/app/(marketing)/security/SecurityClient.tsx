'use client'

import { motion } from 'framer-motion'
import Button from '@/components/landing/ui/Button'

const EASE = [0.22, 1, 0.36, 1] as const

const fadeBlur = {
  initial: { opacity: 0, filter: 'blur(6px)' },
  whileInView: { opacity: 1, filter: 'blur(0px)' },
  viewport: { once: true } as const,
  transition: { duration: 1.2, ease: EASE },
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, filter: 'blur(4px)', y: 16 },
  whileInView: { opacity: 1, filter: 'blur(0px)', y: 0 },
  viewport: { once: true } as const,
  transition: { duration: 1.2, ease: EASE, delay },
})

const sections = [
  {
    title: 'Your data is yours',
    body: 'Customer records, inventory, repair history, bespoke orders, and financial data are stored with care and not shared with outside parties without your knowledge or consent.',
  },
  {
    title: 'Access that fits your team',
    body: 'Staff access is managed by role. You control who sees what, based on their role or location.',
  },
  {
    title: 'Reliable infrastructure',
    body: 'Nexpura runs on modern cloud infrastructure designed for availability and resilience.',
  },
  {
    title: 'Privacy by design',
    body: 'Your customer and business data is handled with discretion. We do not use your data to serve you advertising or share it with outside parties.',
  },
  {
    title: 'Built with care',
    body: 'The platform is developed with attention to stability, access control, and risk reduction.',
  },
]

export default function SecurityClient() {
  return (
    <div className="bg-m-ivory">
      {/* Hero */}
      <section className="pt-24 pb-24 lg:pt-32 lg:pb-32 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p
            {...fadeUp()}
            className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-6"
          >
            Security
          </motion.p>
          <motion.h1
            {...fadeBlur}
            className="font-serif text-[42px] sm:text-[56px] lg:text-[clamp(2.75rem,5vw,4.5rem)] font-normal leading-[1.06] tracking-[-0.015em] text-m-charcoal mb-7"
          >
            Your data, <em className="italic">protected</em>
          </motion.h1>
          <motion.p
            {...fadeUp(0.3)}
            className="text-[16px] sm:text-[18px] leading-[1.55] text-m-text-secondary max-w-[600px] mx-auto"
          >
            Nexpura is built for jewellery businesses that handle sensitive customer records, inventory data, and financial information every day.
          </motion.p>
        </div>
      </section>

      {/* Sections */}
      <section className="py-20 lg:py-32 px-6 sm:px-10 lg:px-20 border-t border-m-border-soft bg-m-white-soft">
        <div className="max-w-[800px] mx-auto">
          {sections.map((section, i) => (
            <motion.div
              key={section.title}
              {...fadeUp(i * 0.1)}
              className="py-10 border-b border-m-border-soft last:border-b-0 first:pt-0"
            >
              <h2 className="font-serif text-[24px] lg:text-[28px] text-m-charcoal mb-4 font-medium leading-[1.25]">
                {section.title}
              </h2>
              <p className="text-[15px] lg:text-[16px] leading-[1.65] text-m-text-secondary">
                {section.body}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 lg:py-32 px-6 sm:px-10 lg:px-20 text-center border-t border-m-border-soft bg-m-charcoal">
        <motion.h2
          {...fadeBlur}
          className="font-serif text-[36px] sm:text-[44px] lg:text-[48px] font-normal leading-[1.12] tracking-[-0.01em] text-white mb-6"
        >
          Questions about security?
        </motion.h2>
        <motion.p
          {...fadeUp(0.1)}
          className="text-[16px] lg:text-[18px] leading-[1.55] text-m-champagne-soft max-w-[500px] mx-auto mb-10"
        >
          If you have specific requirements or questions about how we handle your data, get in touch.
        </motion.p>
        <motion.div {...fadeUp(0.2)} className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Button href="/contact" size="lg" className="!bg-white !text-m-charcoal hover:!bg-m-champagne-tint">
            Book a Guided Demo
          </Button>
        </motion.div>
      </section>
    </div>
  )
}
