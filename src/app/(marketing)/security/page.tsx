import type { Metadata } from "next";
import SecurityClient from "./SecurityClient";

export const metadata: Metadata = {
  title: "Security — Nexpura",
  description:
    "How Nexpura protects your customer records, inventory, and financials — encryption, role-based access, audit trails, and data ownership.",
  openGraph: {
    title: "Security — Nexpura",
    description:
      "Encryption, role-based access, audit trails, and data ownership — how Nexpura keeps jewellery business data safe.",
    images: ["/og-image.png"],
    type: "website",
    siteName: "Nexpura",
  },
};

export default function SecurityPage() {
  return <SecurityClient />;
}
