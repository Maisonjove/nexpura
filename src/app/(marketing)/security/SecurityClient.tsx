'use client'

// ============================================
// Security page — Batch 3 expansion (Kaitlyn 2026-04-28).
//
// Rebuilt to a card/section layout with eight verified pillars:
//   1. Data protection
//   2. Access control
//   3. Payments
//   4. Infrastructure
//   5. Business continuity
//   6. Data ownership
//   7. Audit & activity logs
//   8. Privacy
//
// Every claim was checked against the codebase before being added:
//   - Data protection → src/lib/crypto/secretbox.ts (AES-GCM-256
//     column-level encryption) + src/lib/customer-pii.ts (customer
//     PII bundle encryption).
//   - Access control → src/lib/auth-context.ts (`requirePermission`)
//     plus src/lib/auth/two-factor-cookie.ts.
//   - Payments → src/app/api/webhooks/stripe + Stripe Connect routes.
//   - Infrastructure → Vercel hosting (`@vercel/*`), Supabase
//     (database + auth + storage), Resend (transactional email).
//   - Business continuity → Supabase platform-level automated backups.
//   - Data ownership → src/app/api/data-export + data-delete routes.
//   - Audit & activity logs → src/lib/audit.ts `logAuditEvent`,
//     called from ~98 sites across server actions/routes.
//   - Privacy → links to /privacy.
// ============================================

import { motion } from 'framer-motion'
import Button from '@/components/landing/ui/Button'
import {
  Lock,
  Users,
  CreditCard,
  Server,
  ShieldCheck,
  Database,
  ScrollText,
  Eye,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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

type Pillar = {
  icon: LucideIcon
  title: string
  body: string
  bullets: string[]
}

const pillars: Pillar[] = [
  {
    icon: Lock,
    title: 'Data protection',
    body:
      'Sensitive fields are encrypted at the database column level, and traffic between you and Nexpura is always over HTTPS.',
    bullets: [
      'AES-GCM-256 column-level encryption for customer PII and integration credentials',
      'TLS in transit on every request',
      'Automated daily backups via our hosting platform',
    ],
  },
  {
    icon: Users,
    title: 'Access control',
    body:
      'Staff access is managed by role. You decide who sees what — broken down by role, location, and permission.',
    bullets: [
      'Role-based permissions (owner, manager, staff)',
      'Location-scoped data visibility for multi-store accounts',
      'Two-factor authentication available for sensitive accounts',
    ],
  },
  {
    icon: CreditCard,
    title: 'Payments',
    body:
      'All card processing is handled by Stripe. Nexpura never sees or stores raw card numbers.',
    bullets: [
      'Stripe handles every charge, refund, and recurring subscription',
      'Card details are tokenised by Stripe — they never touch our servers',
      'PCI compliance is maintained by Stripe at the network level',
    ],
  },
  {
    icon: Server,
    title: 'Infrastructure',
    body:
      'Nexpura is built on a small set of trusted, well-known platforms — and nothing else.',
    bullets: [
      'Vercel for application hosting and edge delivery',
      'Supabase for database, authentication, and file storage',
      'Resend for transactional email (receipts, invoices, password resets)',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Business continuity',
    body:
      'Your data and your day-to-day operations are designed to keep running, even when things wobble.',
    bullets: [
      'Automated daily database backups with point-in-time recovery',
      'Globally distributed edge infrastructure',
      'Architected for high availability, with monitoring on every critical path',
    ],
  },
  {
    icon: Database,
    title: 'Data ownership',
    body:
      'Your customer records, inventory, and financial data are yours. Always.',
    bullets: [
      'One-click full data export in JSON from your account settings',
      'Account and tenant deletion on request, processed within 30 days',
      'We never sell your data and never use it to serve you advertising',
    ],
  },
  {
    icon: ScrollText,
    title: 'Audit & activity logs',
    body:
      'Critical actions inside Nexpura — inventory changes, invoices, refunds, team changes, settings updates — are recorded for accountability.',
    bullets: [
      'Append-only audit trail for inventory, invoices, customers, repairs, bespoke jobs, and team changes',
      'Each entry captures who, what, and when',
      'Available to account owners and managers for review',
    ],
  },
  {
    icon: Eye,
    title: 'Privacy',
    body:
      'How we collect, store, and handle your data is documented in plain English.',
    bullets: [
      'No data sold or shared with third parties for marketing',
      'Limited, named subprocessors only (Stripe, Supabase, Vercel, Resend, and AI providers)',
      'See our Privacy Policy for the full picture',
    ],
  },
]

export default function SecurityClient() {
  return (
    <div className="bg-m-ivory">
      {/* Hero */}
      <section className="pt-24 pb-20 lg:pt-32 lg:pb-24 px-6 sm:px-10 lg:px-20 text-center">
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
            className="text-[16px] sm:text-[18px] leading-[1.55] text-m-text-secondary max-w-[620px] mx-auto"
          >
            Nexpura is built for jewellery businesses that handle sensitive
            customer records, inventory data, and financial information every
            day. Here&rsquo;s how we keep all of it safe.
          </motion.p>
        </div>
      </section>

      {/* Pillars grid */}
      <section className="pb-20 lg:pb-28 px-6 sm:px-10 lg:px-20 border-t border-m-border-soft bg-m-white-soft pt-16 lg:pt-24">
        <div className="max-w-[1180px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {pillars.map((pillar, i) => {
              const Icon = pillar.icon
              return (
                <motion.article
                  key={pillar.title}
                  {...fadeUp(Math.min(i * 0.06, 0.4))}
                  className="rounded-2xl border border-m-border-soft bg-m-ivory p-7 sm:p-9 flex flex-col h-full"
                >
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-m-champagne-tint mb-5 shrink-0">
                    <Icon className="w-5 h-5 text-m-charcoal" aria-hidden="true" />
                  </div>
                  <h2 className="font-serif text-[22px] lg:text-[26px] text-m-charcoal mb-3 font-medium leading-[1.25]">
                    {pillar.title}
                  </h2>
                  <p className="text-[15px] lg:text-[16px] leading-[1.65] text-m-text-secondary mb-5">
                    {pillar.body}
                  </p>
                  <ul className="mt-auto space-y-2.5">
                    {pillar.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex gap-3 text-[14px] lg:text-[15px] leading-[1.55] text-m-text-secondary"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[9px] block w-1 h-1 rounded-full bg-[#C9A24A] shrink-0"
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </motion.article>
              )
            })}
          </div>

          {/* Privacy Policy link row */}
          <motion.p
            {...fadeUp(0.1)}
            className="mt-12 text-center text-[14px] lg:text-[15px] text-m-text-secondary"
          >
            Read the full{' '}
            <a
              href="/privacy"
              className="text-m-charcoal underline underline-offset-4 hover:text-m-charcoal-soft transition-colors"
            >
              Privacy Policy
            </a>
            {' '}for details on how we handle your data.
          </motion.p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 lg:py-32 px-6 sm:px-10 lg:px-20 text-center border-t border-m-border-soft bg-m-charcoal">
        <motion.h2
          {...fadeBlur}
          className="font-serif text-[36px] sm:text-[44px] lg:text-[48px] font-normal leading-[1.12] tracking-[-0.01em] text-white mb-6"
        >
          Protect your team, your customers, and your records.
        </motion.h2>
        <motion.p
          {...fadeUp(0.1)}
          className="text-[16px] lg:text-[18px] leading-[1.55] text-m-champagne-soft max-w-[560px] mx-auto mb-10"
        >
          Have specific security requirements or a question about how your data
          is handled? Get in touch — we&rsquo;ll walk you through it.
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
