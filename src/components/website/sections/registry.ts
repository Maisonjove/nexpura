import type { ComponentType } from "react";
import type { SectionType } from "@/lib/templates/types";
import type { SectionProps } from "./types";

import HeroSection from "./HeroSection";
import TextSection from "./TextSection";
import ImageTextSection from "./ImageTextSection";
import GallerySection from "./GallerySection";
import ProductGridSection from "./ProductGridSection";
import CollectionGridSection from "./CollectionGridSection";
import TestimonialsSection from "./TestimonialsSection";
import ContactFormSection from "./ContactFormSection";
import EnquiryFormSection from "./EnquiryFormSection";
import RepairFormSection from "./RepairFormSection";
import AppointmentFormSection from "./AppointmentFormSection";
import FaqSection from "./FaqSection";
import DividerSection from "./DividerSection";
import SpacerSection from "./SpacerSection";

export const SECTION_REGISTRY: Record<SectionType, ComponentType<SectionProps>> = {
  hero: HeroSection,
  text: TextSection,
  image_text: ImageTextSection,
  gallery: GallerySection,
  product_grid: ProductGridSection,
  collection_grid: CollectionGridSection,
  testimonials: TestimonialsSection,
  contact_form: ContactFormSection,
  enquiry_form: EnquiryFormSection,
  repair_form: RepairFormSection,
  appointment_form: AppointmentFormSection,
  faq: FaqSection,
  divider: DividerSection,
  spacer: SpacerSection,
};
