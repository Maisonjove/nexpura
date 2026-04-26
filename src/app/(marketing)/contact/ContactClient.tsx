'use client'

// ============================================
// Contact — restyled per Kaitlyn 2026-04-26 polish-pass.
//   - Compact hero
//   - Form polish: tightened gaps, darker placeholder, custom dropdown
//     chevron, BUTTON.primary on submit, focus-state #C9A24A/20 ring
//     (lives in globals.css .m-form-input:focus)
//   - Right-side info copy refreshed (EMAIL / LIVE CHAT / BOOK A DEMO)
//   - "What happens in a demo" 5-step list refreshed verbatim
//   - framer-motion removed; relies on the same static-token approach
//     the rest of the marketing surface uses
// Form submission logic unchanged — POSTs to /api/contact.
// ============================================

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { SECTION_PADDING, HEADING, BUTTON, CONTAINER } from '@/components/landing/_tokens'

type Channel = {
  label: string
  lines: string[]
}

const CHANNELS: Channel[] = [
  {
    label: 'Email',
    lines: [
      'hello@nexpura.com',
      'We respond within 24 hours',
    ],
  },
  {
    label: 'Live Chat',
    lines: [
      'Available for active customers inside Nexpura',
      'Monday–Friday, 9am–5pm AEST',
    ],
  },
  {
    label: 'Book a Demo',
    lines: [
      '30-minute personalised walkthrough',
      'See how Nexpura maps to your POS, repair, bespoke, inventory, and customer workflows.',
    ],
  },
]

const DEMO_STEPS: string[] = [
  'We learn about your current setup',
  'We walk through the workflows most relevant to your business',
  'You see repairs, bespoke, POS, inventory, and passports in action',
  'We discuss migration and setup options',
  'You get clear next steps, with no pressure',
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
      {/* === Hero — compact tier ====================================== */}
      <section className={`${SECTION_PADDING.compact} text-center`}>
        <div className={CONTAINER.narrow}>
          <span className={HEADING.eyebrow}>Get in Touch</span>
          <h1 className="font-serif text-m-charcoal text-[2rem] md:text-[2.4rem] leading-[1.12] tracking-[-0.005em] mb-4">
            Let&apos;s talk
          </h1>
          <p className="font-sans text-m-text-secondary text-[1rem] md:text-[1.1rem] leading-[1.55] max-w-[600px] mx-auto">
            Book a demo, ask questions, or talk to our team about your migration. We&apos;re real people who understand jewellery businesses.
          </p>
        </div>
      </section>

      {/* === Form + info ============================================== */}
      <section className={`${SECTION_PADDING.standard} pt-0 md:pt-0`}>
        <div className={`${CONTAINER.wide} grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start`}>
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
              <div className="relative">
                <select
                  id="contact-topic"
                  name="topic"
                  className="m-form-input cursor-pointer appearance-none pr-12"
                  defaultValue="demo"
                  required
                >
                  <option value="demo">Book a product demo</option>
                  <option value="trial">Help with my free trial</option>
                  <option value="migration">Migration from another system</option>
                  <option value="pricing">Pricing and plans</option>
                  <option value="other">Something else</option>
                </select>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#8A8276]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
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
                className="bg-[#F1E9D8] border border-[#E4DBC9] text-m-charcoal rounded-[14px] px-4 py-3 font-sans text-[0.92rem] leading-[1.55]"
              >
                Thanks — your message is on its way to hello@nexpura.com. We&apos;ll be in touch within 24 hours.
              </div>
            )}
            {status === 'error' && errorMsg && (
              <p role="alert" className="m-form-error">{errorMsg}</p>
            )}

            <button
              type="submit"
              className={`${BUTTON.primary} mt-2`}
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Sending…' : 'Send Message'}
            </button>
          </form>

          {/* Info column */}
          <div className="space-y-8">
            {CHANNELS.map((c) => (
              <div key={c.label}>
                <span className={HEADING.eyebrow}>{c.label}</span>
                <div className="space-y-1">
                  {c.lines.map((line, i) => (
                    <p
                      key={i}
                      className={
                        i === 0
                          ? 'font-sans text-m-charcoal text-[1.05rem] md:text-[1.1rem] leading-[1.4]'
                          : 'font-sans text-m-text-secondary text-[0.95rem] leading-[1.55]'
                      }
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            ))}

            <div className="border-t border-[#E4DBC9] pt-8">
              <span className={HEADING.eyebrow}>What happens in a demo</span>
              <ol role="list" className="space-y-3.5">
                {DEMO_STEPS.map((step, i) => (
                  <li
                    key={step}
                    className="flex items-start gap-3 font-sans text-m-charcoal text-[0.95rem] leading-[1.55]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#F1E9D8] border border-[#E4DBC9] text-[0.72rem] font-medium text-[#5A554C] flex-shrink-0 tabular-nums"
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border-t border-[#E4DBC9] pt-6">
              <p className="font-sans text-[0.92rem] text-m-text-secondary mb-2">
                Already signed up?
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 font-sans text-[0.95rem] font-medium text-m-charcoal hover:underline underline-offset-4 decoration-m-charcoal"
              >
                Sign in to your account
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
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
