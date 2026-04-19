"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Warms the Next.js App Router prefetch cache for the routes a jeweller
 * actually navigates to in-session. Fires once per app-layout mount.
 *
 * Why not rely on `<Link>`'s default `prefetch="auto"`?
 * Our routes are dynamic (per-tenant, behind auth) so the default only
 * prefetches the loading.tsx + segment shell, NOT the RSC payload. When
 * the user clicks, the RSC fetch still has to run. Explicit
 * `router.prefetch()` forces the full payload into cache.
 *
 * Tenant-prefixed hrefs matter: if we prefetch `/customers` the
 * middleware answers with a 307 redirect to `/{slug}/customers` and the
 * prefetch is effectively wasted. Prefetch the already-correct URL
 * directly.
 *
 * Priority tiers:
 *   Hot     — jeweller navigates here within ~15 s of landing on dashboard.
 *   Warm    — reachable but less common; prefetched later so they don't
 *             compete with the hot tier for the network.
 *   Ignored — everything else is left to `<Link>` default auto-prefetch
 *             when the link scrolls into viewport.
 */

// Jeweller's actual next-click pattern, captured from how the app is used.
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

const WARM_ROUTES = [
  "/sales",
  "/quotes",
  "/suppliers",
  "/expenses",
  "/reports",
  "/passports",
  "/appraisals",
  "/settings",
  "/notifications",
];

interface Props {
  tenantSlug?: string | null;
}

export function RoutePrefetcher({ tenantSlug }: Props) {
  const router = useRouter();

  useEffect(() => {
    // Build tenant-prefixed URLs if we have a slug. Without a slug we fall
    // back to flat paths — the middleware will still rewrite internally.
    const prefix = tenantSlug ? `/${tenantSlug}` : "";
    const hot = HOT_ROUTES.map((r) => prefix + r);
    const warm = WARM_ROUTES.map((r) => prefix + r);

    // Hot routes: 700 ms after mount — past the initial critical-path
    // rendering window but before the user has had time to decide what
    // to click next.
    const t1 = setTimeout(() => {
      for (const r of hot) router.prefetch(r);
    }, 700);

    // Warm routes: 2.5 s after mount — background fill-in.
    const t2 = setTimeout(() => {
      for (const r of warm) router.prefetch(r);
    }, 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [router, tenantSlug]);

  return null;
}
