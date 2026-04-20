'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { tenantSlugFromPathname } from '@/lib/app-routes';

/**
 * Ultra-early hot-route prefetch bootstrap.
 *
 * WHY IT EXISTS
 * -------------
 * The existing `RoutePrefetcher` lives inside `(app)/layout.tsx` —
 * structurally AFTER `<main>{children}</main>` in document order and
 * inside `<LocationProvider>`, `<ErrorBoundary>`, etc. React's
 * concurrent hydration still has to commit the siblings and parents in
 * document order, so its `useEffect` fires only once the whole (app)
 * subtree commits. On the dashboard that's ~8-14 s in — long AFTER the
 * user has already clicked.
 *
 * This component is deliberately the SMALLEST possible client island
 * (no other hooks, no heavy providers, no dependencies beyond
 * next/navigation). It is mounted BEFORE `{children}` in the ROOT
 * layout, so it commits in the root-layout render cycle — before any
 * (app)-tree hydration work. Its `useEffect` therefore fires near the
 * root-layout-committed timestamp, which is measured via a
 * `performance.mark` pair.
 *
 * WHAT IT DOES
 * ------------
 *  - Derives the tenant slug from `location.pathname` (URL is the only
 *    state needed — no server prop, no context).
 *  - On non-tenant pages (/login, /signup, /onboarding, …) it's a no-op.
 *  - Fires `router.prefetch(prefix + r, { kind: 'full' })` for each of
 *    the 10 hot tenant-prefixed jeweller routes.
 *
 * WHY THIS COMPLEMENTS THE OTHER LAYERS
 * -------------------------------------
 *  1. `PrehydrationPrefetch` (src/app/layout.tsx <head> inline script)
 *     fires the raw RSC `fetch()` at HTML-parse time (~1.5 s) — that
 *     warms the Service Worker cache + coalesces any later identical
 *     fetch (see public/sw.js).
 *  2. THIS component fires `router.prefetch()` at root-layout commit
 *     time (measured ~500-1500 ms earlier than the legacy
 *     `RoutePrefetcher`) — that populates Next's internal router
 *     segment cache so a click becomes a true in-memory cache hit
 *     (not even a SW round-trip).
 *  3. The legacy `RoutePrefetcher` still exists in `(app)/layout.tsx`
 *     and fires its hot + warm tiers later; it now mostly handles the
 *     warm-tier routes (/sales /quotes /suppliers etc.) that this
 *     component intentionally does NOT touch.
 *
 * SAFETY
 * ------
 *  - Only fires when the URL's first path segment is a tenant slug
 *    (see `tenantSlugFromPathname` in src/lib/app-routes.ts). On
 *    public routes it does nothing.
 *  - Only prefetches the 10 hot routes. Never sprays the whole app.
 *  - `kind: 'full'` matches what the legacy `RoutePrefetcher` uses —
 *    the SW's coalescing and cookie-keyed cache (v7) already handle
 *    the duplicate-fetch and per-user isolation concerns.
 */

// Keep in sync with RoutePrefetcher.HOT_ROUTES. The cost of a mismatch
// is wasted prefetch or missed coverage, not correctness.
const HOT_ROUTES = [
  '/dashboard',
  '/intake',
  '/pos',
  '/customers',
  '/repairs',
  '/inventory',
  '/invoices',
  '/tasks',
  '/workshop',
  '/bespoke',
];

export function HotRouteBootstrap() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof performance !== 'undefined' && performance.mark) {
      try {
        performance.mark('nx_bootstrap_mount');
      } catch {}
    }
    const slug = tenantSlugFromPathname(pathname);
    if (!slug) return;
    const prefix = `/${slug}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const FULL = 'full' as any;
    // Fire on the next microtask so this runs after the current commit
    // without waiting for a setTimeout slot. `router.prefetch` itself
    // is async and non-blocking; all 10 calls enqueue their work and
    // return immediately.
    queueMicrotask(() => {
      if (typeof performance !== 'undefined' && performance.mark) {
        try {
          performance.mark('nx_bootstrap_fire');
        } catch {}
      }
      for (const r of HOT_ROUTES) {
        router.prefetch(prefix + r, { kind: FULL });
      }
    });
  }, [pathname, router]);

  return null;
}
