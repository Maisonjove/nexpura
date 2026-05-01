"use server";

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await createAdminClient()
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!userData?.tenant_id) throw new Error("No tenant found");
  return { supabase, userId: user.id, tenantId: userData.tenant_id };
}

export interface WebsiteConfigData {
  mode?: string;
  subdomain?: string;
  published?: boolean;
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
  // Multi-mode fields
  website_type?: string;
  external_url?: string;
  external_platform?: string;
  custom_domain?: string;
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
  business_hours?: Record<string, { open: string; close: string; closed: boolean }> | null;
  custom_css?: string;
  social_links?: Record<string, string> | null;
}

export async function getWebsiteConfig(): Promise<{ data?: WebsiteConfigData | null; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();
    const { data, error } = await supabase
      .from("website_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      logger.error("[getWebsiteConfig] Error:", error);
      return { error: error.message };
    }
    return { data };
  } catch (err) {
    logger.error("[getWebsiteConfig] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to get website config" };
  }
}

export async function saveWebsiteConfig(formData: WebsiteConfigData): Promise<{ success?: boolean; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();

    const { data: existing } = await supabase
      .from("website_config")
      .select("id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("website_config")
        .update({ ...formData })
        .eq("tenant_id", tenantId);
      if (error) {
        logger.error("[saveWebsiteConfig] Update error:", error);
        return { error: error.message };
      }
    } else {
      const { error } = await supabase
        .from("website_config")
        .insert({ tenant_id: tenantId, ...formData });
      if (error) {
        logger.error("[saveWebsiteConfig] Insert error:", error);
        return { error: error.message };
      }
    }

    revalidatePath("/website");
    return { success: true };
  } catch (err) {
    logger.error("[saveWebsiteConfig] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to save website config" };
  }
}

export async function publishWebsite(publish: boolean): Promise<{ success?: boolean; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();

    const { data: existing } = await supabase
      .from("website_config")
      .select("id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("website_config")
        .update({ published: publish })
        .eq("tenant_id", tenantId);
      if (error) {
        logger.error("[publishWebsite] Update error:", error);
        return { error: error.message };
      }
    } else {
      const { error } = await supabase
        .from("website_config")
        .insert({ tenant_id: tenantId, published: publish });
      if (error) {
        logger.error("[publishWebsite] Insert error:", error);
        return { error: error.message };
      }
    }

    revalidatePath("/website");
    return { success: true };
  } catch (err) {
    logger.error("[publishWebsite] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to publish website" };
  }
}

/**
 * Flip the tenant's website_type. Used by the Phase 2 entry view to let a
 * user opt out of the hosted/template flow and reach the legacy
 * ConnectMode (website_type === "connect") in WebsiteBuilderClient.
 *
 * Schema/RLS untouched — this only updates the existing column.
 */
export async function switchWebsiteType(
  websiteType: "hosted" | "connect",
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();

    const { data: existing } = await supabase
      .from("website_config")
      .select("id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("website_config")
        .update({ website_type: websiteType })
        .eq("tenant_id", tenantId);
      if (error) {
        logger.error("[switchWebsiteType] Update error:", error);
        return { error: error.message };
      }
    } else {
      const { error } = await supabase
        .from("website_config")
        .insert({ tenant_id: tenantId, website_type: websiteType });
      if (error) {
        logger.error("[switchWebsiteType] Insert error:", error);
        return { error: error.message };
      }
    }

    revalidatePath("/website");
    return { success: true };
  } catch (err) {
    logger.error("[switchWebsiteType] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to switch website type" };
  }
}

export async function checkSubdomainAvailable(subdomain: string, currentTenantId?: string): Promise<{ available: boolean; reason?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();

    // Validate subdomain format
    const trimmed = subdomain?.trim() ?? "";
    
    if (!trimmed || trimmed.length < 3) {
      return { available: false, reason: "Subdomain must be at least 3 characters" };
    }

    if (trimmed.length > 63) {
      return { available: false, reason: "Subdomain must be 63 characters or less" };
    }

    if (!/^[a-z0-9-]+$/.test(trimmed)) {
      return { available: false, reason: "Only lowercase letters, numbers, and hyphens allowed" };
    }

    if (trimmed.startsWith("-") || trimmed.endsWith("-")) {
      return { available: false, reason: "Subdomain cannot start or end with a hyphen" };
    }

    // Check reserved subdomains
    const reserved = ["www", "admin", "api", "app", "mail", "ftp", "blog", "shop", "store", "help", "support"];
    if (reserved.includes(trimmed)) {
      return { available: false, reason: "This subdomain is reserved" };
    }

    const { data, error } = await supabase
      .from("website_config")
      .select("tenant_id")
      .eq("subdomain", trimmed)
      .maybeSingle();

    if (error) {
      logger.error("[checkSubdomainAvailable] Error:", error);
      return { available: false, reason: "Unable to check availability. Please try again." };
    }

    if (!data || data.tenant_id === tenantId) {
      return { available: true };
    }

    return { available: false, reason: "Subdomain is already taken" };
  } catch (err) {
    logger.error("[checkSubdomainAvailable] Unexpected error:", err);
    return { available: false, reason: "Unable to check availability. Please try again." };
  }
}

// Validation helpers moved to ./validation.ts
// Import from "./validation" directly in client components
