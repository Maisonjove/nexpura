import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Pricing — Nexpura",
  description: "Simple, transparent pricing for jewellery businesses of all sizes.",
};

export default function PricingPage() {
  return <PricingClient />;
}
