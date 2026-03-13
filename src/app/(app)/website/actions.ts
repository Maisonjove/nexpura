"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
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
}

export async function getWebsiteConfig() {
  const { supabase, tenantId } = await getAuthContext();
  const { data, error } = await supabase
    .from("website_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveWebsiteConfig(formData: WebsiteConfigData) {
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
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("website_config")
      .insert({ tenant_id: tenantId, ...formData });
    if (error) throw error;
  }

  revalidatePath("/website");
  return { success: true };
}

export async function publishWebsite(publish: boolean) {
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
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("website_config")
      .insert({ tenant_id: tenantId, published: publish });
    if (error) throw error;
  }

  revalidatePath("/website");
  return { success: true };
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
