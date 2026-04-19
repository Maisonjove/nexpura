"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Emits browser-native `<link rel="prefetch">` hints for the hot
 * authenticated routes a jeweller clicks next. Complements, does not
 * replace, Next.js' `router.prefetch()` (which caches RSC payloads in
 * the client router cache) and `<Link prefetch>` (which does viewport-
 * based RSC prefetch).
 *
 * Why add native hints on top of router.prefetch()?
 * Next's router.prefetch() populates the router cache only and uses
 * `fetch` with an RSC-specific request header. Native `<link rel="prefetch">`
 * lets the browser's HTTP cache pre-warm the underlying HTTP/2 connection
 * and fetch route-shared static chunks at low priority. In practice this
 * buys a marginal additional win on the *first click after dashboard
 * load* — the period before router.prefetch() batches have completed.
 *
 * We insert the <link> tags via DOM manipulation so they land immediately
 * at mount time without waiting on React reconciliation, and so we can
 * cleanly remove them on route changes that invalidate the pre-warmed
 * set (e.g. tenant slug changes).
 *
 * Targets only the hot tenant-prefixed routes — prefetching unrelated
 * URLs would be network noise.
 */

const HOT_ROUTES = [
  "/dashboard",
  "/intake",
  "/pos",
  "/customers",
  "/repairs",
  "/inventory",
  "/invoices",
  "/tasks",
  "/workshop",
  "/bespoke",
];

interface Props {
  tenantSlug?: string | null;
}

// Same URL heuristic as TopNav / RoutePrefetcher. See RoutePrefetcher for
// the rationale.
function detectTenantSlugFromPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const seg = pathname.split("/")[1];
  if (!seg || seg.indexOf("-") < 0) return null;
  return seg;
}

export function NativePrefetchHints({ tenantSlug }: Props) {
  const pathname = usePathname();
  const effectiveSlug = tenantSlug ?? detectTenantSlugFromPathname(pathname);

  useEffect(() => {
    const prefix = effectiveSlug ? `/${effectiveSlug}` : "";
    const inserted: HTMLLinkElement[] = [];

    for (const route of HOT_ROUTES) {
      const href = prefix + route;
      // Skip if the browser already has a matching hint (e.g. the user
      // just reloaded and React hot-restored the previous set).
      if (document.querySelector(`link[rel="prefetch"][href="${href}"]`)) continue;

      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = href;
      // `as="document"` tells the browser to prefetch as a top-level HTML
      // document; the response goes into the HTTP cache. If the user ever
      // hard-navs (reload, bookmark, cold tab), the served HTML can be
      // cache-hit. For SPA navs this is a lower-priority backup to
      // router.prefetch().
      link.setAttribute("as", "document");
      // Same-origin request — cookies ride with it automatically.
      document.head.appendChild(link);
      inserted.push(link);
    }

    return () => {
      for (const link of inserted) link.remove();
    };
  }, [effectiveSlug]);

  return null;
}
