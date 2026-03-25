"use server";

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

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
}

export async function getWebsiteConfig(): Promise<{ data?: any; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();
    const { data, error } = await supabase
      .from("website_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      console.error("[getWebsiteConfig] Error:", error);
      return { error: error.message };
    }
    return { data };
  } catch (err) {
    console.error("[getWebsiteConfig] Unexpected error:", err);
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
        console.error("[saveWebsiteConfig] Update error:", error);
        return { error: error.message };
      }
    } else {
      const { error } = await supabase
        .from("website_config")
        .insert({ tenant_id: tenantId, ...formData });
      if (error) {
        console.error("[saveWebsiteConfig] Insert error:", error);
        return { error: error.message };
      }
    }

    revalidatePath("/website");
    return { success: true };
  } catch (err) {
    console.error("[saveWebsiteConfig] Unexpected error:", err);
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
        console.error("[publishWebsite] Update error:", error);
        return { error: error.message };
      }
    } else {
      const { error } = await supabase
        .from("website_config")
        .insert({ tenant_id: tenantId, published: publish });
      if (error) {
        console.error("[publishWebsite] Insert error:", error);
        return { error: error.message };
      }
    }

    revalidatePath("/website");
    return { success: true };
  } catch (err) {
    console.error("[publishWebsite] Unexpected error:", err);
    return { error: err instanceof Error ? err.message : "Failed to publish website" };
  }
}

export async function checkSubdomainAvailable(subdomain: string, currentTenantId?: string) {
  const { supabase, tenantId } = await getAuthContext();

  if (!subdomain || subdomain.length < 3) {
    return { available: false, reason: "Subdomain must be at least 3 characters" };
  }

  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    return { available: false, reason: "Only lowercase letters, numbers, and hyphens allowed" };
  }

  const { data } = await supabase
    .from("website_config")
    .select("tenant_id")
    .eq("subdomain", subdomain)
    .maybeSingle();

  if (!data || data.tenant_id === tenantId) {
    return { available: true };
  }

  return { available: false, reason: "Subdomain is already taken" };
}
