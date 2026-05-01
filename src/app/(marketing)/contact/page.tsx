import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact — Nexpura",
  description:
    "Get in touch with the Nexpura team, ask a question, or book a guided demo tailored to your jewellery business.",
  openGraph: {
    title: "Contact — Nexpura",
    description:
      "Get in touch with the Nexpura team or book a guided demo for your jewellery business.",
    images: ["/og-image.png"],
    type: "website",
    siteName: "Nexpura",
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
