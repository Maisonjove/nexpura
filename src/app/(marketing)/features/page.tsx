import type { Metadata } from "next";
import FeaturesClient from "./FeaturesClient";

export const metadata: Metadata = {
  title: "Features — Nexpura",
  description:
    "Nine connected modules — POS, inventory, repairs, bespoke, customers, invoicing, reports, AI copilot, and the digital passport — explained for jewellers.",
  openGraph: {
    title: "Features — Nexpura",
    description:
      "Nine connected modules built around how jewellers actually work — POS, inventory, repairs, bespoke, and more.",
    images: ["/og-image.png"],
    type: "website",
    siteName: "Nexpura",
  },
};

export default function FeaturesPage() {
  return <FeaturesClient />;
}
