// ============================================
// Terms of Service — uses the shared LegalPageLayout (Kaitlyn
// 2026-04-26 editorial-refinement pass). Body copy preserved
// verbatim from the previous revision.
// ============================================

import type { Metadata } from "next"
import LegalPageLayout, { type LegalSection } from "@/components/marketing/LegalPageLayout"

export const metadata: Metadata = {
  title: "Terms of Service — Nexpura",
  description:
    "The Nexpura Terms of Service — your agreement when subscribing to and using the Nexpura jewellery operating system, including billing, data, and acceptable use.",
  openGraph: {
    title: "Terms of Service — Nexpura",
    description:
      "The Nexpura Terms of Service — your agreement when subscribing to and using the Nexpura jewellery operating system, including billing, data, and acceptable use.",
    images: ["/og-image.png"],
    type: "website",
    siteName: "Nexpura",
  },
}

const SECTIONS: LegalSection[] = [
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
    body: "Nexpura offers tiered subscription plans (Boutique, Studio, and Atelier) billed monthly. Pricing is shown in your regional currency (AUD, USD, GBP, or EUR) based on your location, and prices listed on the pricing page are exclusive of applicable taxes; taxes (such as GST, VAT, or US sales tax) are calculated and added at checkout based on your billing address. New accounts begin with a 14-day free trial. Payment details are required to activate your trial. You will not be charged until your 14-day trial ends. You can cancel anytime before then. All payments are processed securely through Stripe. Subscriptions automatically renew unless cancelled before the renewal date. You may cancel at any time through your account settings.",
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
    <LegalPageLayout
      pageTitle="Terms of Service"
      lastUpdated="April 2026"
      sections={SECTIONS}
      closingNote="For questions about these Terms, contact us at hello@nexpura.com."
    />
  )
}
