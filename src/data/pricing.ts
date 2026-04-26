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
  /** Primary + optional secondary CTA per Kaitlyn 2026-04-26. All
   *  three plans now share the same primary action ("Start Free
   *  Trial") for visual consistency across the row; Studio + Atelier
   *  add a quieter secondary text link beneath. Both hrefs include
   *  `?plan=…` already; the &currency=… param is appended at click
   *  time by the card. */
  cta: {
    primaryLabel: string
    primaryHref: string
    secondaryLabel?: string
    secondaryHref?: string
  }
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
    cta: {
      primaryLabel: "Start Free Trial",
      primaryHref: "/signup?plan=boutique",
    },
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
      AUD: { amount: 149, symbol: "$", stripePriceId: "price_1TQOcjPO3tmWPoC06MfsG8Q9" },
      USD: { amount:  99, symbol: "$", stripePriceId: "price_1TQOd2PO3tmWPoC0QbRGrlav" },
      GBP: { amount:  79, symbol: "£", stripePriceId: "price_1TQOdIPO3tmWPoC0aDRAAuYo" },
      EUR: { amount:  89, symbol: "€", stripePriceId: "price_1TQOdbPO3tmWPoC0Tvvohyrs" },
    },
  },
  {
    id: "studio",
    name: "Studio",
    description:
      "For growing jewellery businesses that need deeper reporting, branding, and team visibility across locations.",
    cta: {
      primaryLabel: "Start Free Trial",
      primaryHref: "/signup?plan=studio",
      secondaryLabel: "or book a demo",
      secondaryHref: "/contact?plan=studio&intent=demo",
    },
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
      AUD: { amount: 299, symbol: "$", stripePriceId: "price_1TQOezPO3tmWPoC0sfC3xuW6" },
      USD: { amount: 199, symbol: "$", stripePriceId: "price_1TQOfOPO3tmWPoC0Hym9da51" },
      GBP: { amount: 159, symbol: "£", stripePriceId: "price_1TQOfqPO3tmWPoC0lG2FoPZI" },
      EUR: { amount: 179, symbol: "€", stripePriceId: "price_1TQOg9PO3tmWPoC02Obh12Cy" },
    },
  },
  {
    id: "atelier",
    name: "Atelier",
    description:
      "For multi-store jewellery businesses and high-volume workshops needing advanced support, analytics, and scale.",
    cta: {
      primaryLabel: "Start Free Trial",
      primaryHref: "/signup?plan=atelier",
      secondaryLabel: "or talk to sales",
      secondaryHref: "/contact?plan=atelier&intent=sales",
    },
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
      AUD: { amount: 499, symbol: "$", stripePriceId: "price_1TQOgmPO3tmWPoC0HR7HWjsv" },
      USD: { amount: 329, symbol: "$", stripePriceId: "price_1TQOh0PO3tmWPoC0Q5CayeYC" },
      GBP: { amount: 269, symbol: "£", stripePriceId: "price_1TQOhPPO3tmWPoC0KDM97KCZ" },
      EUR: { amount: 299, symbol: "€", stripePriceId: "price_1TQOhnPO3tmWPoC0rVfjfqAM" },
    },
  },
]

const EU_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
]

// Fallback for unknown / unsupported regions is USD per Kaitlyn 2026-04-26.
// Rationale: AU is a small slice of global traffic; defaulting unknown
// visitors to USD is a more sensible "rest of the world" default for a
// platform marketing in English first.
export function countryToCurrency(country: string | undefined | null): CurrencyCode {
  if (!country) return "USD"
  const c = country.toUpperCase()
  if (c === "AU") return "AUD"
  if (c === "US") return "USD"
  if (c === "GB" || c === "UK") return "GBP"
  if (EU_COUNTRIES.includes(c)) return "EUR"
  return "USD"
}

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ["AUD", "USD", "GBP", "EUR"]
