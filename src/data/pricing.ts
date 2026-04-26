// src/data/pricing.ts
//
// Single source of truth for the marketing pricing page.
// Per Kaitlyn 2026-04-26 pricing brief on PR #42.
//
// Three tiers (Boutique / Studio / Atelier), each with feature list,
// CTA, and a per-currency price block. Prices are intentional fixed
// regional presets (NOT live FX) so a US visitor sees a clean $99,
// not $97.43.

export type CurrencyCode = "AUD" | "USD" | "GBP" | "EUR"

export type CurrencyPrice = {
  amount: number // monthly amount in major units (149, not 14900)
  symbol: string // "$", "£", "€"
  stripePriceId?: string // filled in when Stripe is configured
}

export type Plan = {
  id: "boutique" | "studio" | "atelier"
  name: string
  description: string
  ctaLabel: string
  ctaHref: string // includes ?plan=… query already; you'll append &currency= at click time
  isFeatured: boolean // "Most Popular" badge
  isFromPrice: boolean // shows "From" prefix
  features: string[]
  pricing: Record<CurrencyCode, CurrencyPrice>
}

export const PLANS: Plan[] = [
  {
    id: "boutique",
    name: "Boutique",
    description:
      "For single-store jewellers who need one connected system for sales, repairs, bespoke, and stock.",
    ctaLabel: "Start Free Trial",
    ctaHref: "/signup?plan=boutique",
    isFeatured: false,
    isFromPrice: false,
    features: [
      "POS, inventory, repairs, and bespoke workflows",
      "Customers CRM and invoicing",
      "Command Centers and AI Copilot",
      "Guided migration included",
      "1 staff · 1 store",
    ],
    pricing: {
      AUD: { amount: 149, symbol: "$" },
      USD: { amount: 99, symbol: "$" },
      GBP: { amount: 79, symbol: "£" },
      EUR: { amount: 89, symbol: "€" },
    },
  },
  {
    id: "studio",
    name: "Studio",
    description:
      "For growing jewellery businesses that need deeper reporting, branding, and team visibility across locations.",
    ctaLabel: "Book a Demo",
    ctaHref: "/contact?plan=studio",
    isFeatured: true,
    isFromPrice: false,
    features: [
      "Everything in Boutique",
      "Full analytics dashboard",
      "Up to 5 staff · up to 3 stores",
      "Custom branding",
      "Website and digital presence tools",
    ],
    pricing: {
      AUD: { amount: 299, symbol: "$" },
      USD: { amount: 199, symbol: "$" },
      GBP: { amount: 159, symbol: "£" },
      EUR: { amount: 179, symbol: "€" },
    },
  },
  {
    id: "atelier",
    name: "Atelier",
    description:
      "For multi-store jewellery businesses and high-volume workshops needing advanced support, analytics, and scale.",
    ctaLabel: "Talk to Sales",
    ctaHref: "/contact?plan=atelier",
    isFeatured: false,
    isFromPrice: true,
    features: [
      "Everything in Studio",
      "Unlimited staff and stores",
      "Custom analytics",
      "AI product descriptions",
      "Priority migration support",
      "Dedicated success contact",
    ],
    pricing: {
      AUD: { amount: 499, symbol: "$" },
      USD: { amount: 329, symbol: "$" },
      GBP: { amount: 269, symbol: "£" },
      EUR: { amount: 299, symbol: "€" },
    },
  },
]

const EU_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]

export function countryToCurrency(country: string | undefined | null): CurrencyCode {
  if (!country) return "AUD"
  const c = country.toUpperCase()
  if (c === "AU") return "AUD"
  if (c === "US") return "USD"
  if (c === "GB" || c === "UK") return "GBP"
  if (EU_COUNTRIES.includes(c)) return "EUR"
  return "AUD"
}

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ["AUD", "USD", "GBP", "EUR"]
