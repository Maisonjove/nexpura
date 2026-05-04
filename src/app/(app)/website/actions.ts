"use server";

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";

import { flushSentry } from "@/lib/sentry-flush";
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
      await flushSentry();
      return { error: error.message };
    }
    return { data };
  } catch (err) {
    logger.error("[getWebsiteConfig] Unexpected error:", err);
    await flushSentry();
    return { error: err instanceof Error ? err.message : "Failed to get website config" };
  }
}

/**
 * Validate a website URL string before persisting it. Pre-fix the
 * /website/connect form would accept any free-text input — typoed
 * domains like `htps://shop.com` or `totally-fake-domain-zzz.test`
 * just got stored on tenants.website_url with no validation, so the
 * downstream "Not connected" indicator from ConnectionStatus had no
 * attribution to root cause. Now: client-side format check + server-
 * side resolve check, with clear errors for each failure mode.
 */
async function validateWebsiteUrl(rawUrl: string): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return { ok: false, error: "URL is required." };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Invalid URL — must include the protocol (e.g. https://shop.example.com)." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "URL must start with http:// or https://." };
  }
  // Reject obvious junk: TLDs that don't resolve, IP literals, etc.
  // .test, .invalid, .example are RFC 2606 reserved (will never resolve).
  const host = parsed.hostname;
  if (!host.includes(".")) {
    return { ok: false, error: "URL host must include a domain (e.g. shop.example.com)." };
  }
  const reservedTLDs = ["test", "invalid", "example", "localhost"];
  const hostLower = host.toLowerCase();
  for (const tld of reservedTLDs) {
    if (hostLower === tld || hostLower.endsWith("." + tld)) {
      return { ok: false, error: `URL uses the reserved \`.${tld}\` suffix — pick a real domain.` };
    }
  }

  // Server-side resolve check via DNS-over-HTTPS (Google). Cheap, no
  // libraries needed, and tolerant of Vercel's edge runtime where
  // Node's `dns` module is unavailable.
  try {
    const lookup = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=A`,
      { method: "GET", signal: AbortSignal.timeout(5000) },
    );
    if (lookup.ok) {
      const dnsBody = await lookup.json() as { Status?: number; Answer?: Array<unknown> };
      // Status 0 = NOERROR; 3 = NXDOMAIN. Accept anything that returned
      // at least one A record. NXDOMAIN means the domain truly doesn't
      // resolve — reject.
      if (dnsBody.Status === 3 || !dnsBody.Answer || dnsBody.Answer.length === 0) {
        return { ok: false, error: `Domain ${host} doesn't resolve. Check the URL and try again, or save it later once DNS is set up.` };
      }
    }
    // If the DNS API itself is unreachable, fall through to accept —
    // we don't want a Google outage to block valid saves.
  } catch {
    // Network error on DNS lookup — accept and let downstream
    // ConnectionStatus probe surface "Not connected" if needed.
  }

  return { ok: true, url: parsed };
}

export async function saveWebsiteConfig(formData: WebsiteConfigData): Promise<{ success?: boolean; error?: string }> {
  try {
    const { supabase, tenantId } = await getAuthContext();

    // Validate any external_url before persisting (Group 13 audit).
    if (formData.external_url) {
      const v = await validateWebsiteUrl(formData.external_url);
      if (!v.ok) return { error: v.error };
      // Normalise — strip trailing slash, lowercase host
      formData.external_url = v.url.protocol + "//" + v.url.host.toLowerCase() + (v.url.pathname === "/" ? "" : v.url.pathname);
    }

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
        await flushSentry();
        return { error: error.message };
      }
    } else {
      const { error } = await supabase
        .from("website_config")
        .insert({ tenant_id: tenantId, ...formData });
      if (error) {
        logger.error("[saveWebsiteConfig] Insert error:", error);
        await flushSentry();
        return { error: error.message };
      }
    }

    revalidatePath("/website");
    return { success: true };
  } catch (err) {
    logger.error("[saveWebsiteConfig] Unexpected error:", err);
    await flushSentry();
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
        await flushSentry();
        return { error: error.message };
      }
    } else {
      const { error } = await supabase
        .from("website_config")
        .insert({ tenant_id: tenantId, published: publish });
      if (error) {
        logger.error("[publishWebsite] Insert error:", error);
        await flushSentry();
        return { error: error.message };
      }
    }

    revalidatePath("/website");
    return { success: true };
  } catch (err) {
    logger.error("[publishWebsite] Unexpected error:", err);
    await flushSentry();
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
        await flushSentry();
        return { error: error.message };
      }
    } else {
      const { error } = await supabase
        .from("website_config")
        .insert({ tenant_id: tenantId, website_type: websiteType });
      if (error) {
        logger.error("[switchWebsiteType] Insert error:", error);
        await flushSentry();
        return { error: error.message };
      }
    }

    revalidatePath("/website");
    return { success: true };
  } catch (err) {
    logger.error("[switchWebsiteType] Unexpected error:", err);
    await flushSentry();
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

    // Subdomain uniqueness is a GLOBAL property — we have to be able to see
    // every tenant's website_config row to detect collisions. Pre-fix this
    // query used the RLS-scoped `supabase` client from getAuthContext, which
    // returns NULL for any other tenant's row (RLS blocks the read). The
    // code then read the NULL as "no collision" and returned available:true
    // for subdomains that were actually taken — Joey hit this with
    // "maisonjove" in the QA pass. Switched to the admin client so the
    // existence check sees every row; we still exclude the caller's own
    // tenant_id so users can re-confirm their existing subdomain.
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("website_config")
      .select("tenant_id")
      .eq("subdomain", trimmed)
      .maybeSingle();

    if (error) {
      logger.error("[checkSubdomainAvailable] Error:", error);
      await flushSentry();
      return { available: false, reason: "Unable to check availability. Please try again." };
    }

    if (!data || data.tenant_id === tenantId) {
      return { available: true };
    }

    return { available: false, reason: "Subdomain is already taken" };
  } catch (err) {
    logger.error("[checkSubdomainAvailable] Unexpected error:", err);
    await flushSentry();
    return { available: false, reason: "Unable to check availability. Please try again." };
  }
}

// Validation helpers moved to ./validation.ts
// Import from "./validation" directly in client components
