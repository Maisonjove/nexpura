import type { Metadata } from "next";
import { TEMPLATES } from "@/lib/templates/data";
import TemplateGalleryClient from "./TemplateGalleryClient";

export const metadata: Metadata = {
  title: "Choose a website template — Nexpura",
  description: "Pick from ten premium jewellery templates. Apply one and edit it in the builder.",
};

export default function TemplateGalleryPage() {
  return <TemplateGalleryClient templates={TEMPLATES} />;
}
