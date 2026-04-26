// ============================================
// Privacy Policy — restyled per Kaitlyn 2026-04-26 polish-pass:
//  - Compact hero (eyebrow LEGAL · serif H1 · sans "Last updated")
//  - Two-column layout below: sticky TOC left (240px), body right (max
//    680px). Mobile stacks (TOC on top, body below).
//  - H1 serif, section H2 sans + medium, body sans leading-1.65.
//  - space-y-10 between sections; space-y-4 within.
//  - Global section[id] { scroll-margin-top } in globals.css handles
//    sticky-header offset on TOC clicks.
// Body copy preserved verbatim from the prior version (legal text not
// rewritten — only layout + typography updated). One label rename:
// "Data Storage & Security" → "Data Security" per Kaitlyn's TOC.
// ============================================

import type { Metadata } from "next"
import { SECTION_PADDING, HEADING, CONTAINER } from "@/components/landing/_tokens"

export const metadata: Metadata = {
  title: "Privacy Policy — Nexpura",
  description: "How Nexpura collects, uses, and protects your data.",
}

type Section = { id: string; title: string; body: string }

const SECTIONS: Section[] = [
  {
    id: "information-we-collect",
    title: "Information We Collect",
    body: "We collect information you provide directly to us, including your name, email address, business details, and payment information when you register for or use Nexpura. We also collect business data you enter into the platform — such as inventory, customer records, repair jobs, and sales transactions — which remains yours at all times.",
  },
  {
    id: "how-we-use-information",
    title: "How We Use Information",
    body: "We use your information to provide, maintain, and improve the Service; process payments; send transactional and product communications; respond to support requests; and comply with legal obligations. We do not use your business data for any purpose beyond delivering the Service to you.",
  },
  {
    id: "data-security",
    title: "Data Security",
    body: "Your data is stored on Supabase infrastructure hosted in Australia (where available) with industry-standard encryption at rest and in transit. We implement appropriate technical and organisational measures to protect your data against unauthorised access, loss, or disclosure. Regular backups are performed automatically.",
  },
  {
    id: "third-party-services",
    title: "Third-Party Services",
    body: "Nexpura uses a limited set of third-party services to operate the platform: Stripe for payment processing, Supabase for database and authentication, Vercel for application hosting, and Resend for transactional email. Each maintains their own privacy and security commitments. We do not sell or share your data with third parties for marketing purposes.",
  },
  {
    id: "cookies",
    title: "Cookies",
    body: "We use cookies and similar technologies to maintain your authentication session, remember your preferences, and analyse aggregate usage patterns. Essential cookies are required for the Service to function. You can manage non-essential cookies through your browser settings.",
  },
  {
    id: "your-rights",
    title: "Your Rights",
    body: "You have the right to access, correct, or delete your personal data at any time. You may export your business data from within the platform. To request deletion of your account, contact us at hello@nexpura.com. We will process your request within 30 days.",
  },
  {
    id: "data-retention",
    title: "Data Retention",
    body: "We retain your data for as long as your account is active or as needed to provide the Service. If you cancel, your data will be retained for 90 days to allow for reactivation, after which it will be permanently deleted. Anonymised, aggregated statistical data may be retained indefinitely.",
  },
  {
    id: "changes-to-this-policy",
    title: "Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification before they take effect. The date at the top of this page indicates when the policy was last revised.",
  },
  {
    id: "contact",
    title: "Contact",
    body: "For privacy-related questions or to exercise your data rights, please contact us at hello@nexpura.com.",
  },
]

export default function PrivacyPage() {
  return (
    <div className="bg-m-ivory">
      {/* === Hero — compact tier ====================================== */}
      <section className={`${SECTION_PADDING.compact} text-center`}>
        <div className={CONTAINER.narrow}>
          <span className={HEADING.eyebrow}>Legal</span>
          <h1 className="font-serif text-m-charcoal text-[2rem] md:text-[2.4rem] leading-[1.12] tracking-[-0.005em] mb-3">
            Privacy Policy
          </h1>
          <p className="font-sans text-[0.92rem] text-m-text-secondary">
            Last updated · March 2026
          </p>
        </div>
      </section>

      {/* === Body — two-column with sticky TOC on lg+ ================= */}
      <section className="px-6 pb-16 md:pb-20">
        <div className={`${CONTAINER.wide} grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-10 lg:gap-16`}>
          {/* TOC */}
          <nav aria-label="Privacy Policy contents" className="lg:sticky lg:top-[104px] lg:self-start">
            <h2 className="font-sans text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#8A8276] mb-4">
              Contents
            </h2>
            <ul role="list" className="space-y-2.5">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="font-sans text-[0.92rem] text-m-charcoal transition-opacity duration-200 hover:opacity-65"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Body */}
          <div className="max-w-[680px]">
            <div className="space-y-10">
              {SECTIONS.map((s) => (
                <section key={s.id} id={s.id} aria-labelledby={`${s.id}-heading`}>
                  <h2
                    id={`${s.id}-heading`}
                    className="font-sans font-medium text-m-charcoal text-[1.15rem] md:text-[1.25rem] leading-[1.3] mb-4"
                  >
                    {s.title}
                  </h2>
                  <div className="space-y-4 font-sans text-[0.95rem] md:text-[1rem] leading-[1.65] text-m-text-secondary">
                    <p>{s.body}</p>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
