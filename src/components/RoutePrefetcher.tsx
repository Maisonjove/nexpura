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

    // Hot routes: 50 ms after mount — as early as possible, deferred just
    // enough to let React settle the initial render.
    //
    // CRITICAL: `kind: 'full'` is required. Without options, router.prefetch()
    // defaults to `kind: 'auto'`, which for dynamic (authenticated, per-tenant)
    // routes only prefetches the loading.tsx shell — the page DATA is still
    // fetched fresh on click, burning ~1.6 s of TTFB. `kind: 'full'` forces
    // the full RSC payload into the router cache so the click is a true
    // cache-hit.
    // PrefetchKind is not exported from next/navigation's public API; cast
    // the string literal. The router reads the string value directly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const FULL = "full" as any;

    // Hot routes: 50 ms after mount — early enough to complete before a
    // deliberating user clicks, late enough to let React settle its
    // initial commit. (queueMicrotask was tried but fires AFTER React
    // hydration completes on complex pages — ~3 s in, not at t=0. So
    // it provided no measurable advantage over 50 ms while creating
    // confusing interaction with the browser's request coalescing on
    // some paths.)
    const t1 = setTimeout(() => {
      for (const r of hot) router.prefetch(r, { kind: FULL });
    }, 50);

    // Warm routes: 1.5 s after mount — background fill-in that doesn't
    // compete with the hot tier for the initial network burst.
    const t2 = setTimeout(() => {
      for (const r of warm) router.prefetch(r, { kind: FULL });
    }, 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [router, tenantSlug]);

  return null;
}
