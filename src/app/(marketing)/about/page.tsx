import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "About — Nexpura",
  description:
    "Nexpura is the modern operating system for jewellery businesses. Learn about our mission to empower independent jewellers worldwide.",
};

export default function AboutPage() {
  return <AboutClient />;
}
