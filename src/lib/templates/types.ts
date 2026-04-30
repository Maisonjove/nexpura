/**
 * Phase 1 jewellery website template types.
 * Static, non-AI templates that seed the existing site_pages / site_sections tables.
 */

export type SectionType =
  | "hero"
  | "text"
  | "image_text"
  | "gallery"
  | "product_grid"
  | "collection_grid"
  | "testimonials"
  | "contact_form"
  | "enquiry_form"
  | "repair_form"
  | "appointment_form"
  | "faq"
  | "divider"
  | "spacer";

export type PageType = "home" | "about" | "contact" | "policies" | "custom";

export type Font = "Inter" | "Playfair Display" | "Cormorant Garamond";

export type TemplateSection = {
  type: SectionType;
  content: Record<string, unknown>;
  styles?: Record<string, unknown>;
};

export type TemplatePage = {
  slug: string;
  title: string;
  type: PageType;
  metaTitle: string;
  metaDescription: string;
  sections: TemplateSection[];
};

export type Template = {
  id: string;
  name: string;
  description: string;
  bestFor: string;
  styleKeywords: string[];
  palette: { primary: string; secondary: string; accent?: string };
  typography: { heading: Font; body: Font };
  pages: TemplatePage[];
  nav: { label: string; slug: string }[];
  footer: {
    copy: string;
    columns?: { heading: string; links: { label: string; href: string }[] }[];
  };
  seo: { title: string; description: string };
  /** CSS gradient string used as a placeholder thumbnail in the gallery */
  thumbnailGradient: string;
};

export type Theme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  headingFont: Font;
  bodyFont: Font;
};
