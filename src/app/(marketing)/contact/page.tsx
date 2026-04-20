import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Contact — Nexpura",
  description: "Get in touch with the Nexpura team or book a demo for your jewellery business.",
};

export default function ContactPage() {
  return <ContactClient />;
}
