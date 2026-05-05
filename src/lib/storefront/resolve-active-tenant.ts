import { createAdminClient } from "@/lib/supabase/admin";
import type { WebsiteConfig } from "@/app/(app)/website/types";

/**
 * Resolved (config + tenant) shape for callers. The config row is `*`-shaped
 * so existing page bodies continue to work without changes; the tenant slice
 * is just the four columns we need for nav / fallback / debugging.
 */
export type WebsiteConfigRow = WebsiteConfig & {
  tenant_id?: string;
  // Permit any extra columns that may be added later — pages access many
  // optional fields off `config.*`, and the existing TS shape is permissive.
  [k: string]: unknown;
};

export type ResolvedTenant = {
  config: WebsiteConfigRow;
  tenant: {
    id: string;
    slug: string | null;
    business_name: string | null;
    deleted_at: string | null;
  };
};

/**
 * Resolve a published, non-deleted tenant + its website_config from a subdomain.
 *
 * Hard policy distinction (Joey 2026-05-05):
 *   - `published=false` means "not ready yet, but coming back". Preview makes
 *     sense here (tenant owner reviewing pre-launch). When `opts.preview` is
 *     true AND `opts.userId` matches the tenant owner, the unpublished config
 *     is returned.
 *   - `tenants.deleted_at IS NOT NULL` means "tenant is gone from the
 *     platform". HARD CUTOFF — no preview override, no auth bypass, no
 *     metadata leak. Returns null in any state once deleted_at is set.
 *
 * Future contributors: do NOT loosen the deleted_at check to allow preview.
 * Soft-delete and unpublished have different semantics and different policies.
 *
 * Returns: { config, tenant } when active+published (or active+preview+owner),
 *          null otherwise (callers should call notFound() for 404 metadata).
 *
 * TODO(p2c): notFound() returns HTTP 200 instead of 404 — Next.js
 * cacheComponents quirk; tracked as cleanup #28. The metadata response from
 * `notFoundMetadata()` below is a partial mitigation: even when the framework
 * emits 200, crawlers see `robots: noindex,nofollow` + a generic title so no
 * tenant info leaks.
 */
export async function resolveActiveTenantConfig(
  subdomain: string,
  opts?: { preview?: boolean; userId?: string },
): Promise<ResolvedTenant | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("website_config")
    .select("*, tenants!inner(id, slug, business_name, deleted_at)")
    .eq("subdomain", subdomain)
    .is("tenants.deleted_at", null) // HARD CUTOFF
    .maybeSingle();
  if (error || !data) return null;
  const tenant = (data as { tenants?: ResolvedTenant["tenant"] | null }).tenants;
  if (!tenant) return null;

  // Strip the joined relation off the config row so callers can pass the
  // rest as-is into renderers expecting a flat website_config shape.
  const { tenants: _tenants, ...flatConfig } = data as Record<string, unknown> & {
    tenants?: unknown;
  };
  void _tenants;
  const config = flatConfig as WebsiteConfigRow;

  // Published path
  if (config.published) {
    return { config, tenant };
  }
  // Preview path — only if owner is requesting
  if (opts?.preview && opts.userId) {
    const { data: userRow } = await admin
      .from("users")
      .select("tenant_id")
      .eq("id", opts.userId)
      .single();
    if (userRow?.tenant_id === tenant.id) {
      return { config, tenant };
    }
  }
  return null;
}

/**
 * Canonical Metadata payload for "tenant not resolvable" cases. Used by the 7
 * generateMetadata exporters so a soft-deleted or never-published tenant can
 * never leak business_name / meta_title / meta_description to crawlers.
 *
 * `robots: { index: false, follow: false }` keeps Google/Bing from indexing
 * the path even on a brief 200 from notFound() (see TODO above). Empty OG /
 * Twitter cards stop social-platform unfurls from caching tenant info.
 */
export function notFoundMetadata() {
  return {
    title: "Page not found",
    description: "",
    robots: { index: false, follow: false },
    openGraph: {
      title: "Page not found",
      description: "",
      images: [] as string[],
    },
    twitter: {
      card: "summary" as const,
      title: "Page not found",
      description: "",
    },
  };
}
