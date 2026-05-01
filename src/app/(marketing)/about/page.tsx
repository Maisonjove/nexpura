import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "About — Nexpura",
  description:
    "Nexpura is the modern operating system for jewellery businesses. Meet the team and learn about our mission to empower independent jewellers worldwide.",
  openGraph: {
    title: "About — Nexpura",
    description:
      "Nexpura is the modern operating system for jewellery businesses. Meet the team and learn about our mission.",
    images: ["/og-image.png"],
    type: "website",
    siteName: "Nexpura",
  },
};

export default function AboutPage() {
  return <AboutClient />;
}
