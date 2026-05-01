import type { Metadata } from "next";
import { headers } from "next/headers";
import { countryToCurrency } from "@/data/pricing";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing — Nexpura",
  description:
    "Three plans for jewellery businesses of every size. Start with a 14-day free trial — Boutique, Studio, or Atelier — billed monthly or annually.",
  openGraph: {
    title: "Pricing — Nexpura",
    description:
      "Three plans for jewellery businesses of every size. Start with a 14-day free trial.",
    images: ["/og-image.png"],
    type: "website",
    siteName: "Nexpura",
  },
};

export default async function PricingPage() {
  const h = await headers();
  const country = h.get("x-vercel-ip-country");
  const initialCurrency = countryToCurrency(country);
  return <PricingClient initialCurrency={initialCurrency} />;
}
