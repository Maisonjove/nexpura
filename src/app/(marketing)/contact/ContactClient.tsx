'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

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

const channels = [
  {
    label: 'Email',
    value: 'hello@nexpura.com',
    note: 'We respond within 24 hours',
  },
  {
    label: 'Live chat',
    value: 'Available inside the app',
    note: 'Mon–Fri, 9am–5pm AEST',
  },
  {
    label: 'Book a demo',
    value: '30-minute walkthrough',
    note: "We'll show you exactly what Nexpura can do",
  },
]

const expectations = [
  'We learn about your business and current system',
  'Walkthrough of the features most relevant to you',
  'Live demonstration of repairs, bespoke, and POS',
  'Migration plan for your existing data',
  'Pricing and next steps — no pressure',
]

export default function ContactClient() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="pt-20 pb-20 lg:pt-28 lg:pb-24 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p
            {...fadeUp()}
            className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-6"
          >
            Get in Touch
          </motion.p>
          <motion.h1
            {...fadeBlur}
            className="font-serif text-4xl sm:text-5xl lg:text-[clamp(2.75rem,5vw,4.25rem)] font-normal leading-[1.08] tracking-[-0.01em] text-stone-900 mb-7"
          >
            Let&apos;s <em className="italic">talk</em>
          </motion.h1>
          <motion.p
            {...fadeUp(0.3)}
            className="text-base lg:text-lg leading-relaxed text-stone-500 max-w-[600px] mx-auto"
          >
            Book a demo, ask questions, or talk to our team about your migration.
            We&apos;re real people who understand jewellery businesses.
          </motion.p>
        </div>
      </section>

      {/* Form + info */}
      <section className="pb-24 lg:pb-32 px-6 sm:px-10 lg:px-20">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Form */}
          <motion.form {...fadeUp()} className="space-y-7">
            <div className="grid grid-cols-2 gap-6">
              <Field label="First name" placeholder="Jane" />
              <Field label="Last name" placeholder="Smith" />
            </div>
            <Field label="Business name" placeholder="Smith & Co Jewellers" />
            <Field
              label="Email address"
              placeholder="jane@smithjewellers.com"
              type="email"
            />
            <div>
              <label className="block text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-2">
                What are you enquiring about?
              </label>
              <select className="w-full bg-transparent border-b border-stone-300 py-3 text-[0.9375rem] text-stone-900 focus:outline-none focus:border-stone-900 transition-colors duration-300 cursor-pointer">
                <option value="">Select a topic</option>
                <option value="demo">Book a product demo</option>
                <option value="trial">Help with my free trial</option>
                <option value="migration">Migration from another system</option>
                <option value="pricing">Pricing and plans</option>
                <option value="other">Something else</option>
              </select>
            </div>
            <div>
              <label className="block text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-2">
                Message
              </label>
              <textarea
                rows={4}
                placeholder="Tell us about your business..."
                className="w-full bg-transparent border-b border-stone-300 py-3 text-[0.9375rem] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition-colors duration-300 resize-none"
              />
            </div>
            <button
              type="submit"
              className="
                inline-flex items-center justify-center mt-2
                min-w-[180px] px-10 py-4
                bg-gradient-to-b from-[#3a3a3a] to-[#1a1a1a]
                rounded-full
                shadow-[0_2px_4px_rgba(0,0,0,0.25),0_8px_24px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]
                transition-shadow duration-400
                hover:shadow-[0_4px_8px_rgba(0,0,0,0.25),0_16px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]
                relative overflow-hidden cursor-pointer
              "
            >
              <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.06] to-transparent pointer-events-none" />
              <span className="text-base font-medium text-white tracking-[0.01em] relative z-10">
                Send message
              </span>
            </button>
          </motion.form>

          {/* Info */}
          <motion.div {...fadeUp(0.2)} className="space-y-12">
            <div>
              <p className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-6">
                Other ways to reach us
              </p>
              <div className="divide-y divide-stone-200 border-y border-stone-200">
                {channels.map((c) => (
                  <div key={c.label} className="py-5 flex flex-col gap-1">
                    <span className="text-[0.75rem] tracking-[0.1em] uppercase text-stone-400">
                      {c.label}
                    </span>
                    <span className="font-serif text-lg text-stone-900">
                      {c.value}
                    </span>
                    <span className="text-[0.8125rem] text-stone-500">
                      {c.note}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[0.75rem] tracking-[0.2em] text-stone-400 uppercase mb-6">
                What happens in a demo
              </p>
              <ul className="space-y-4">
                {expectations.map((e, i) => (
                  <li
                    key={e}
                    className="flex items-start gap-4 text-[0.9375rem] text-stone-700"
                  >
                    <span className="text-sm tabular-nums text-stone-300 font-medium pt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-stone-200 pt-6">
              <p className="text-[0.875rem] text-stone-500 mb-2">
                Already signed up?
              </p>
              <Link
                href="/login"
                className="text-[0.9375rem] text-stone-900 underline underline-offset-4 hover:opacity-60 transition-opacity duration-300"
              >
                Sign in to your account →
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

function Field({
  label,
  placeholder,
  type = 'text',
}: {
  label: string
  placeholder: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-[0.75rem] tracking-[0.15em] uppercase text-stone-400 mb-2">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full bg-transparent border-b border-stone-300 py-3 text-[0.9375rem] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 transition-colors duration-300"
      />
    </div>
  )
}
