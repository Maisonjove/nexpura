// ============================================
// Privacy Policy — uses the shared LegalPageLayout (Kaitlyn 2026-04-26
// editorial-refinement pass). Body copy preserved verbatim from the
// previous revision; layout/typography lives in the shared component.
// ============================================

import type { Metadata } from "next"
import LegalPageLayout, { type LegalSection } from "@/components/marketing/LegalPageLayout"

export const metadata: Metadata = {
  title: "Privacy Policy — Nexpura",
  description: "How Nexpura collects, uses, and protects your data.",
}

const SECTIONS: LegalSection[] = [
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
    <LegalPageLayout
      pageTitle="Privacy Policy"
      lastUpdated="March 2026"
      sections={SECTIONS}
    />
  )
}
