import type { Metadata } from "next";
import FeaturesClient from "./FeaturesClient";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Features — Nexpura",
  description: "Every feature Nexpura offers, explained for jewellers.",
};

export default function FeaturesPage() {
  return <FeaturesClient />;
}
