'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import Button from '@/components/landing/ui/Button'

/**
 * Contact page restyled to the homepage system per Kaitlyn brief #2
 * Section 10G + wired to /api/contact in Joey's follow-up sweep
 * (item 2/6). Submitting POSTs JSON to /api/contact, which forwards
 * to hello@nexpura.com via Resend with reply-to set to the submitter.
 *
 * No DB persistence on the client side — if a CRM record is wanted
 * later, the API can be extended without changing this component.
 */

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
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    setErrorMsg(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const payload = {
      first_name: String(fd.get('first_name') ?? ''),
      last_name: String(fd.get('last_name') ?? ''),
      business_name: String(fd.get('business_name') ?? ''),
      email: String(fd.get('email') ?? ''),
      topic: String(fd.get('topic') ?? ''),
      message: String(fd.get('message') ?? ''),
    }
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        setStatus('error')
        setErrorMsg(body.error || 'Something went wrong. Please email hello@nexpura.com directly.')
        return
      }
      setStatus('sent')
      form.reset()
    } catch {
      setStatus('error')
      setErrorMsg("Couldn't reach our server. Please email hello@nexpura.com directly.")
    }
  }

  return (
    <div className="bg-m-ivory">
      {/* Hero */}
      <section className="pt-24 pb-20 lg:pt-32 lg:pb-24 px-6 sm:px-10 lg:px-20 text-center">
        <div className="max-w-[820px] mx-auto">
          <motion.p
            {...fadeUp()}
            className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-6"
          >
            Get in Touch
          </motion.p>
          <motion.h1
            {...fadeBlur}
            className="font-serif text-[42px] sm:text-[56px] lg:text-[clamp(2.75rem,5vw,4.5rem)] font-normal leading-[1.06] tracking-[-0.015em] text-m-charcoal mb-7"
          >
            Let&apos;s <em className="italic">talk</em>
          </motion.h1>
          <motion.p
            {...fadeUp(0.3)}
            className="text-[16px] sm:text-[18px] leading-[1.55] text-m-text-secondary max-w-[600px] mx-auto"
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
          <motion.form {...fadeUp()} onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="grid grid-cols-2 gap-5">
              <Field label="First name" name="first_name" placeholder="Jane" required />
              <Field label="Last name" name="last_name" placeholder="Smith" />
            </div>
            <Field label="Business name" name="business_name" placeholder="Smith & Co Jewellers" />
            <Field
              label="Email address"
              name="email"
              placeholder="jane@smithjewellers.com"
              type="email"
              required
            />
            <div>
              <label htmlFor="contact-topic" className="m-form-label">
                What are you enquiring about?
              </label>
              <select
                id="contact-topic"
                name="topic"
                className="m-form-input cursor-pointer"
                defaultValue="demo"
                required
              >
                <option value="demo">Book a product demo</option>
                <option value="trial">Help with my free trial</option>
                <option value="migration">Migration from another system</option>
                <option value="pricing">Pricing and plans</option>
                <option value="other">Something else</option>
              </select>
            </div>
            <div>
              <label htmlFor="contact-message" className="m-form-label">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={4}
                placeholder="Tell us about your business..."
                className="m-form-input m-form-textarea"
                required
                minLength={5}
                maxLength={4000}
              />
            </div>

            {status === 'sent' && (
              <div
                role="status"
                aria-live="polite"
                className="bg-m-champagne-tint border border-m-champagne-soft text-m-charcoal rounded-[14px] px-4 py-3 text-[14px] leading-[1.55]"
              >
                Thanks — your message is on its way to hello@nexpura.com. We&apos;ll be in touch within 24 hours.
              </div>
            )}
            {status === 'error' && errorMsg && (
              <p role="alert" className="m-form-error">{errorMsg}</p>
            )}

            <Button type="submit" size="lg" className="mt-2" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send message'}
            </Button>
          </motion.form>

          {/* Info */}
          <motion.div {...fadeUp(0.2)} className="space-y-12">
            <div>
              <p className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-6">
                Other ways to reach us
              </p>
              <div className="divide-y divide-m-border-soft border-y border-m-border-soft">
                {channels.map((c) => (
                  <div key={c.label} className="py-5 flex flex-col gap-1">
                    <span className="text-[11px] tracking-[0.14em] uppercase text-m-text-faint font-medium">
                      {c.label}
                    </span>
                    <span className="font-serif text-[20px] text-m-charcoal">
                      {c.value}
                    </span>
                    <span className="text-[13px] text-m-text-secondary">
                      {c.note}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[12px] tracking-[0.18em] text-m-text-faint uppercase font-medium mb-6">
                What happens in a demo
              </p>
              <ul className="space-y-4">
                {expectations.map((e, i) => (
                  <li
                    key={e}
                    className="flex items-start gap-4 text-[15px] text-m-text-secondary leading-[1.6]"
                  >
                    <span className="text-[13px] tabular-nums text-m-text-faint font-medium pt-0.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-m-border-soft pt-6">
              <p className="text-[14px] text-m-text-secondary mb-2">
                Already signed up?
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-[15px] font-sans font-medium text-m-charcoal hover:underline underline-offset-4 decoration-m-charcoal"
              >
                Sign in to your account
                <span aria-hidden>→</span>
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
  name,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string
  name: string
  placeholder: string
  type?: string
  required?: boolean
}) {
  const id = `contact-${name}`
  return (
    <div>
      <label htmlFor={id} className="m-form-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="m-form-input"
      />
    </div>
  )
}
