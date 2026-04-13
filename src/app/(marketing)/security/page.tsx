import type { Metadata } from "next";
import SecurityClient from "./SecurityClient";

export const metadata: Metadata = {
  title: "Security — Nexpura",
  description:
    "Learn how Nexpura protects your customer records, inventory data, and financial information.",
};

export default function SecurityPage() {
  return <SecurityClient />;
}
