// Shared types for Website Builder

export type WebsiteType = "hosted" | "connect" | "domain-guide";
export type Tab = "setup" | "branding" | "content" | "ai" | "domain" | "advanced" | "preview";

export interface AISuggestions {
  suggestions?: string[];
  rationale?: string;
  action?: string;
}

export interface WebsiteConfig {
  id?: string;
  tenant_id?: string;
  mode?: string;
  published?: boolean;
  subdomain?: string;
  custom_domain?: string;
  business_name?: string;
  tagline?: string;
  logo_url?: string;
  hero_image_url?: string;
  primary_color?: string;
  secondary_color?: string;
  font?: string;
  about_text?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_address?: string;
  social_instagram?: string;
  social_facebook?: string;
  stripe_enabled?: boolean;
  show_prices?: boolean;
  allow_enquiry?: boolean;
  meta_title?: string;
  meta_description?: string;
  website_type?: string;
  external_url?: string;
  external_platform?: string;
  domain_verified?: boolean;
  // Advanced settings
  announcement_bar?: string;
  announcement_bar_enabled?: boolean;
  enable_appointments?: boolean;
  enable_repairs_enquiry?: boolean;
  enable_whatsapp_chat?: boolean;
  whatsapp_number?: string;
  google_analytics_id?: string;
  facebook_pixel_id?: string;
  catalogue_show_sku?: boolean;
  catalogue_show_weight?: boolean;
  catalogue_show_metal?: boolean;
  catalogue_show_stone?: boolean;
  catalogue_grid_columns?: number;
  // Business hours & custom styling
  business_hours?: BusinessHours | null;
  custom_css?: string;
  social_links?: SocialLinks | null;
}

export interface BusinessHourEntry {
  open: string;  // e.g. "09:00"
  close: string; // e.g. "17:00"
  closed: boolean;
}

export interface BusinessHours {
  monday: BusinessHourEntry;
  tuesday: BusinessHourEntry;
  wednesday: BusinessHourEntry;
  thursday: BusinessHourEntry;
  friday: BusinessHourEntry;
  saturday: BusinessHourEntry;
  sunday: BusinessHourEntry;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  pinterest?: string;
  tiktok?: string;
  youtube?: string;
}

export interface WebsiteBuilderProps {
  initial: WebsiteConfig | null;
  tenantId: string;
}
