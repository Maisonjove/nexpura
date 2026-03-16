import { type SupabaseClient } from "@supabase/supabase-js";

/**
 * Extract subdomain from a host header value.
 *
 * Returns the subdomain string for:
 *   acme.nexpura.com  →  "acme"
 *
 * Returns null for:
 *   nexpura.com         (apex)
 *   www.nexpura.com     (www)
 *   localhost:3000      (local dev — no subdomain routing)
 *   nexpura-xxx.vercel.app  (Vercel preview — no subdomain)
 */
export function getSubdomain(host: string): string | null {
  // Strip port
  const hostname = host.split(":")[0];

  // Production: <slug>.nexpura.com
  const prodMatch = hostname.match(/^([a-z0-9-]+)\.nexpura\.com$/);
  if (prodMatch) {
    const sub = prodMatch[1];
    // Exclude reserved names
    if (sub === "www" || sub === "nexpura" || sub === "app" || sub === "api") {
      return null;
    }
    return sub;
  }

  // All other patterns (localhost, vercel preview) — no subdomain routing
  return null;
}

/**
 * Look up a tenant ID by its URL slug.
 * Uses the admin/service-role client to bypass RLS.
 */
export async function getTenantBySlug(
  slug: string,
  // Accept any Supabase client; typed loosely to avoid coupling to createAdminClient
  adminClient: SupabaseClient
): Promise<string | null> {
  try {
    const { data } = await adminClient
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}
