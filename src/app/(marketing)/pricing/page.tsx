import type { Metadata } from "next";
import { headers } from "next/headers";
import { countryToCurrency } from "@/data/pricing";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing — Nexpura",
  description: "Simple, transparent pricing for jewellery businesses of all sizes.",
};

export default async function PricingPage() {
  const h = await headers();
  const country = h.get("x-vercel-ip-country");
  const initialCurrency = countryToCurrency(country);
  return <PricingClient initialCurrency={initialCurrency} />;
}
