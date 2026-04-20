import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolve the jeweller's public-facing display name for a subdomain.
 *
 * Fallback order: website_config.meta_title → website_config.business_name →
 * the subdomain with its first letter capitalised (so "nexpura" becomes
 * "Nexpura", not the raw lowercase slug).
 *
 * Used by shop page generateMetadata() calls so every tab title reflects
 * the jeweller's brand, not the Nexpura platform marketing default or the
 * literal word "Store".
 */
export async function getShopDisplayName(subdomain: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("website_config")
    .select("business_name, meta_title")
    .eq("subdomain", subdomain)
    .maybeSingle();

  const metaTitle = (data?.meta_title as string | null) ?? null;
  const businessName = (data?.business_name as string | null) ?? null;
  return metaTitle || businessName || formatSubdomain(subdomain);
}

function formatSubdomain(subdomain: string): string {
  if (!subdomain) return "Shop";
  return subdomain.charAt(0).toUpperCase() + subdomain.slice(1);
}
