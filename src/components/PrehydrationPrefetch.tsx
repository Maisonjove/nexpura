/**
 * Pre-hydration hot-route warmup.
 *
 * Problem: `RoutePrefetcher` calls `router.prefetch()` from a `useEffect`.
 * On a complex page (dashboard) the effect doesn't fire until React has
 * completed hydration — measured at ~2.9 s after HTML parse on production.
 * That's the entire "first click feels cold" window.
 *
 * Solution: emit an inline `<script>` during server render. The browser
 * executes it synchronously during HTML parse, BEFORE any JS bundles have
 * been parsed and well before React hydrates. The script fires `fetch()`
 * requests that mimic Next's RSC prefetch (same URL + `rsc: 1` header).
 * The responses land in the browser's HTTP cache.
 *
 * When React later hydrates and `router.prefetch()` runs with the same URL
 * + headers, the browser serves the response from HTTP cache (~0-10 ms)
 * instead of re-hitting the origin (~1650 ms). The prefetch cache populates
 * immediately; a click that arrives during the gap finds a warm router
 * cache.
 *
 * This is a server component so the inline script content is part of the
 * first-streamed HTML — no JS parsing required to emit it.
 */

const HOT_ROUTES = [
  "customers",
  "repairs",
  "inventory",
  "invoices",
  "tasks",
  "workshop",
  "bespoke",
  "intake",
];

interface Props {
  tenantSlug?: string | null;
}

export function PrehydrationPrefetch({ tenantSlug }: Props) {
  if (!tenantSlug) return null;

  // IIFE runs during HTML parse. Uses `var`/function to avoid relying on
  // any runtime being loaded first. Swallows all errors — any failure is
  // silent, the normal router.prefetch() still runs later as a safety net.
  const js = `(function(){try{var h=[${HOT_ROUTES.map((r) => JSON.stringify(r)).join(",")}];var p=${JSON.stringify(tenantSlug)};for(var i=0;i<h.length;i++){fetch('/'+p+'/'+h[i],{headers:{'rsc':'1','next-router-prefetch':'1'},credentials:'include'}).catch(function(){});}}catch(e){}})()`;

  return (
    // eslint-disable-next-line react/no-danger
    <script dangerouslySetInnerHTML={{ __html: js }} />
  );
}
