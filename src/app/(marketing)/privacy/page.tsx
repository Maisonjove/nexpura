// ============================================
// Privacy Policy — uses the shared LegalPageLayout (Kaitlyn 2026-04-26
// editorial-refinement pass). Body copy preserved verbatim from the
// previous revision; layout/typography lives in the shared component.
// ============================================

import type { Metadata } from "next"
import LegalPageLayout, { type LegalSection } from "@/components/marketing/LegalPageLayout"

export const metadata: Metadata = {
  title: "Privacy Policy — Nexpura",
  description:
    "How Nexpura collects, uses, and protects your data — including subprocessors, retention, export, and deletion rights.",
  openGraph: {
    title: "Privacy Policy — Nexpura",
    description:
      "How Nexpura collects, uses, and protects your data — including subprocessors, retention, export, and deletion rights.",
    images: ["/og-image.png"],
    type: "website",
    siteName: "Nexpura",
  },
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
    title: "Service Providers",
    body: "Nexpura uses a small, named set of third-party service providers (subprocessors) to operate the platform. Each maintains their own privacy and security commitments, and we limit what we share with each provider to what is strictly required to deliver the service. We do not sell or share your data with third parties for marketing purposes.",
    providers: [
      { name: "Vercel", purpose: "Application hosting and edge delivery." },
      { name: "Supabase", purpose: "Primary database, authentication, and file storage." },
      { name: "Stripe", purpose: "Payment processing for subscriptions and in-app charges." },
      { name: "Resend", purpose: "Transactional email — invoices, receipts, password resets." },
      { name: "Twilio", purpose: "SMS and WhatsApp notifications where you have opted in." },
      { name: "Anthropic", purpose: "AI assistance for in-app features (e.g. quote/invoice parsing)." },
      { name: "OpenAI", purpose: "AI assistance for in-app features (e.g. quote/invoice parsing)." },
    ],
  },
  {
    id: "cookies",
    title: "Cookies",
    body: "We use cookies and similar technologies to maintain your authentication session, remember your preferences, and analyse aggregate usage patterns. Essential cookies are required for the Service to function. You can manage non-essential cookies through your browser settings. We also store a non-personal preference (your manually selected pricing-page currency) in your browser's localStorage so that returning visits remember your choice; this is held only on your device and is not transmitted to or stored on our servers.",
  },
  {
    id: "region-detection",
    title: "Region Detection",
    body: "When you visit our pricing page we read an approximate country signal provided by our hosting platform's edge headers (derived from your IP address) to suggest an appropriate default currency for display. This signal is processed transiently at request time, is not linked to your account or identity, and is not retained. You can manually change the displayed currency at any time, and your selection takes precedence over the auto-detected default.",
  },
  {
    id: "your-rights",
    title: "Your Rights",
    body: "You have the right to access, correct, or delete your personal data at any time. You may also request a portable copy of your data, restrict certain uses, or object to processing where applicable under your local data protection law.",
  },
  {
    id: "data-export",
    title: "Data Export",
    body: "Account owners and managers can export a complete copy of their tenant's data — customers, inventory, invoices, repairs, bespoke jobs, and related records — in JSON format from inside the application. The export covers everything you have entered into Nexpura and is available on demand from your account settings.",
  },
  {
    id: "data-deletion",
    title: "Data Deletion",
    body: "Account owners can submit a deletion request from within the application or by writing to hello@nexpura.com. Deletion is processed as a 30-day soft-delete window during which the request can be cancelled and the account restored. After the 30-day window, your tenant data is permanently and irreversibly deleted from our active systems. Routine encrypted backups follow a separate, time-limited retention schedule before being purged.",
  },
  {
    id: "data-retention",
    title: "Data Retention",
    body: "We retain your data for as long as your account is active or as needed to provide the Service. If you cancel, your data is retained for 90 days to allow for reactivation, after which it is permanently deleted. Anonymised, aggregated statistical data may be retained indefinitely. Records that we are legally required to keep — for example tax invoices and payment records — are retained for the period required by applicable law.",
  },
  {
    id: "changes-to-this-policy",
    title: "Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification before they take effect. The date at the top of this page indicates when the policy was last revised.",
  },
  {
    id: "contact",
    title: "Contact",
    body: "For questions about this Privacy Policy or to exercise your data rights, contact us at hello@nexpura.com.",
  },
]

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      pageTitle="Privacy Policy"
      lastUpdated="April 2026"
      sections={SECTIONS}
      closingNote="For questions about this Privacy Policy, contact us at hello@nexpura.com."
    />
  )
}
