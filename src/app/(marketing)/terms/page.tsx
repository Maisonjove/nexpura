// ============================================
// Terms of Service — restyled per Kaitlyn 2026-04-26 polish-pass.
// Same shape as the new Privacy page (compact hero + sticky TOC two-
// column body). Body copy preserved verbatim. Two label renames per
// Kaitlyn's TOC: "Account Registration" → "Accounts", "Subscription
// and Payment" → "Subscriptions".
// ============================================

import type { Metadata } from "next"
import { SECTION_PADDING, HEADING, CONTAINER } from "@/components/landing/_tokens"

export const metadata: Metadata = {
  title: "Terms of Service — Nexpura",
  description: "Nexpura Terms of Service — your agreement when using the platform.",
}

type Section = { id: string; title: string; body: string }

const SECTIONS: Section[] = [
  {
    id: "acceptance-of-terms",
    title: "Acceptance of Terms",
    body: "By accessing or using Nexpura (\"Service\"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.",
  },
  {
    id: "description-of-service",
    title: "Description of Service",
    body: "Nexpura is a software-as-a-service platform for jewellery businesses, providing tools for inventory management, point of sale, repairs, bespoke job management, customer relationships, invoicing, and related operations.",
  },
  {
    id: "accounts",
    title: "Accounts",
    body: "You must provide accurate and complete information when creating your account. You are responsible for maintaining the security of your account credentials and for all activities that occur under your account.",
  },
  {
    id: "subscriptions",
    title: "Subscriptions",
    body: "Nexpura offers subscription plans billed monthly or annually. All payments are processed securely through Stripe. Subscriptions automatically renew unless cancelled before the renewal date. You may cancel at any time through your account settings.",
  },
  {
    id: "data-and-privacy",
    title: "Data and Privacy",
    body: "Your business data remains yours. We do not sell or share your data with third parties. Data is stored securely and backed up regularly. Please review our Privacy Policy for full details on how we handle your information.",
  },
  {
    id: "acceptable-use",
    title: "Acceptable Use",
    body: "You agree to use Nexpura only for lawful business purposes. You may not use the Service to violate any applicable laws, infringe on third-party rights, or interfere with the operation of the Service.",
  },
  {
    id: "service-availability",
    title: "Service Availability",
    body: "We strive to maintain high availability but do not guarantee uninterrupted access. Scheduled maintenance will be communicated in advance where possible.",
  },
  {
    id: "limitation-of-liability",
    title: "Limitation of Liability",
    body: "To the maximum extent permitted by law, Nexpura shall not be liable for indirect, incidental, special, or consequential damages arising from your use of the Service.",
  },
  {
    id: "changes-to-terms",
    title: "Changes to Terms",
    body: "We may update these terms from time to time. We will notify you of significant changes via email or in-app notification. Continued use of the Service after changes constitutes acceptance of the new terms.",
  },
  {
    id: "contact",
    title: "Contact",
    body: "For questions about these Terms, please contact us at hello@nexpura.com.",
  },
]

export default function TermsPage() {
  return (
    <div className="bg-m-ivory">
      {/* === Hero — compact tier ====================================== */}
      <section className={`${SECTION_PADDING.compact} text-center`}>
        <div className={CONTAINER.narrow}>
          <span className={HEADING.eyebrow}>Legal</span>
          <h1 className="font-serif text-m-charcoal text-[2rem] md:text-[2.4rem] leading-[1.12] tracking-[-0.005em] mb-3">
            Terms of Service
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
          <nav aria-label="Terms of Service contents" className="lg:sticky lg:top-[104px] lg:self-start">
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
