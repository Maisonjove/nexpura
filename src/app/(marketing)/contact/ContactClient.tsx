'use client'

// ============================================
// Contact / Book a Demo — Batch 2 (Kaitlyn 2026-04-28).
//
// /contact            → "Get in touch" enquiry form
// /contact?intent=demo → "Book a guided Nexpura walkthrough" with extra
//                        demo-specific fields (POS, stores, pain point,
//                        preferred time)
// /contact?intent=sales → same demo flow, sales topic preselected
//
// IMPORTANT: the form-submit handler still POSTs to /api/contact. The
// `intent`, `current_pos`, `num_stores`, `pain_point`, and
// `preferred_time` fields are appended to the existing payload as
// optional extras. /api/contact tolerates unknown fields (it stores the
// full body), so this is additive — no API change required.
// ============================================

import Link from 'next/link'
import { Suspense, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { SECTION_PADDING, HEADING, BUTTON, CONTAINER } from '@/components/landing/_tokens'

type Channel = {
  label: string
  lines: string[]
}

const CHANNELS: Channel[] = [
  {
    label: 'Email',
    lines: ['hello@nexpura.com', 'We respond within 24 hours'],
  },
  {
    label: 'Live Chat',
    lines: [
      'Available for active customers inside Nexpura',
      'Monday–Friday, 9am–5pm AEST',
    ],
  },
  {
    label: 'Book a Guided Demo',
    lines: [
      '30-minute personalised walkthrough',
      'We map repairs, bespoke, POS, inventory, and customer records to your team — without the sales theatre.',
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

function ContactClientInner() {
  const searchParams = useSearchParams()
  const intent = searchParams.get('intent') // "demo" | "sales" | null
  const planParam = searchParams.get('plan') // optional, passed from pricing

  const isDemoMode = intent === 'demo' || intent === 'sales'

  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Form-submit handler — payload shape unchanged for the existing
  // fields. New optional fields (current_pos, num_stores, pain_point,
  // preferred_time, intent, plan) are appended only when they have
  // values — /api/contact accepts the larger body without breaking.
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (status === 'sending') return
    setStatus('sending')
    setErrorMsg(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const payload: Record<string, string> = {
      first_name: String(fd.get('first_name') ?? ''),
      last_name: String(fd.get('last_name') ?? ''),
      business_name: String(fd.get('business_name') ?? ''),
      email: String(fd.get('email') ?? ''),
      topic: String(fd.get('topic') ?? ''),
      message: String(fd.get('message') ?? ''),
    }
    if (intent) payload.intent = intent
    if (planParam) payload.plan = planParam
    const optionalFields = ['current_pos', 'num_stores', 'pain_point', 'preferred_time']
    for (const key of optionalFields) {
      const v = fd.get(key)
      if (v && String(v).trim()) payload[key] = String(v)
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

  // Heading + subcopy + topic default + submit label all swap based on
  // ?intent. Default (no intent) keeps the prior generic enquiry flow.
  const heading = isDemoMode
    ? 'Book a guided Nexpura walkthrough.'
    : 'Get in touch with the team.'
  const subcopy = isDemoMode
    ? 'See how Nexpura maps to your POS, repairs, bespoke jobs, inventory, passports, and team workflows.'
    : 'Questions about migration, pricing, or the product? We respond within one business day.'
  const submitLabel = isDemoMode ? 'Book a Guided Demo' : 'Send Enquiry'
  const defaultTopic = isDemoMode ? 'demo' : 'demo'

  return (
    <div className="bg-m-ivory">
      {/* === Hero ===================================================== */}
      <section className={`${SECTION_PADDING.compact} text-center`}>
        <div className={CONTAINER.narrow}>
          <span className={HEADING.eyebrow}>
            {isDemoMode ? 'Book a Demo' : 'Get in Touch'}
          </span>
          <h1 className="font-serif text-m-charcoal text-[2rem] md:text-[2.4rem] leading-[1.12] tracking-[-0.005em] mb-4">
            {heading}
          </h1>
          <p className="font-sans text-m-text-secondary text-[1rem] md:text-[1.1rem] leading-[1.6] max-w-[640px] mx-auto">
            {subcopy}
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
                  defaultValue={defaultTopic}
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

            {/* Demo-specific fields — Batch 2.
                Render only when the visitor arrived via /contact?intent=demo
                (or intent=sales). On the generic /contact route these
                fields are not shown, keeping the lightweight enquiry form. */}
            {isDemoMode && (
              <div
                id="demo-fields"
                aria-label="Demo-specific details"
                className="space-y-5 rounded-[14px] border border-[#E4DBC9] bg-white/60 p-5 md:p-6"
              >
                <p className="font-sans text-[12px] tracking-[0.18em] uppercase text-m-text-faint font-medium">
                  About your business
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Field
                    label="Current POS / system"
                    name="current_pos"
                    placeholder="Lightspeed, Shopify, paper, etc."
                  />
                  <Field
                    label="Number of stores"
                    name="num_stores"
                    placeholder="1"
                    type="text"
                  />
                </div>
                <Field
                  label="Main workflow pain point"
                  name="pain_point"
                  placeholder="Repairs falling through the cracks, etc."
                />
                <Field
                  label="Preferred demo time"
                  name="preferred_time"
                  placeholder="Tuesday afternoons AEST, etc."
                />
              </div>
            )}

            <div>
              <label htmlFor="contact-message" className="m-form-label">
                {isDemoMode ? 'A short note about your business' : 'Message'}
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={4}
                placeholder={
                  isDemoMode
                    ? 'A few sentences about your business and what you want to see in the walkthrough.'
                    : 'Tell us about your business...'
                }
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
                {isDemoMode
                  ? 'Thanks — your demo request is on its way to the team. We respond within one business day.'
                  : "Thanks — your message is on its way to hello@nexpura.com. We'll be in touch within 24 hours."}
              </div>
            )}
            {status === 'error' && errorMsg && (
              <p role="alert" className="m-form-error">{errorMsg}</p>
            )}

            <button
              type="submit"
              className={`${BUTTON.primary} mt-2`}
              disabled={status === 'sending'}
              aria-busy={status === 'sending'}
            >
              {status === 'sending' ? 'Sending…' : submitLabel}
            </button>

            <p className="font-sans text-[0.85rem] text-m-text-muted leading-[1.55]">
              We respond within 1 business day. Your details are private and
              never shared.
            </p>
          </form>

          {/* Info column */}
          <div className="space-y-8">
            {CHANNELS.map((c) => (
              <div key={c.label}>
                <span className={HEADING.eyebrow}>{c.label}</span>
                <div className="space-y-1">
                  {c.lines.map((line, i) => {
                    const isEmail = line === 'hello@nexpura.com'
                    const baseClass =
                      i === 0
                        ? 'font-sans text-m-charcoal text-[1.05rem] md:text-[1.1rem] leading-[1.4]'
                        : 'font-sans text-m-text-secondary text-[0.95rem] leading-[1.55]'
                    return (
                      <p key={i} className={baseClass}>
                        {isEmail ? (
                          <a
                            href="mailto:hello@nexpura.com"
                            className="text-amber-700 underline-offset-4 hover:underline"
                          >
                            {line}
                          </a>
                        ) : (
                          line
                        )}
                      </p>
                    )
                  })}
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

      {/* === Closing block — Batch 2 ================================= */}
      <section
        className={`${SECTION_PADDING.compact} text-center border-t border-m-border-soft`}
      >
        <div className={CONTAINER.narrow}>
          <h2 className={HEADING.h2Closing}>
            Book a walkthrough built around your current setup.
          </h2>
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

export default function ContactClient() {
  // useSearchParams() must be wrapped in Suspense for Next 15.
  return (
    <Suspense
      fallback={
        <div className="bg-m-ivory min-h-[60vh] flex items-center justify-center">
          <p className="font-sans text-[0.92rem] text-m-text-muted">Loading…</p>
        </div>
      }
    >
      <ContactClientInner />
    </Suspense>
  )
}
