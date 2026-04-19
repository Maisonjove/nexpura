/**
 * Pre-hydration hot-route warmup.
 *
 * Emits an inline <script> in the very first HTML chunk so the browser
 * executes it during HTML parse — before any JS bundles, before React,
 * long before any useEffect. For authenticated tenant-prefixed URLs, it
 * fires fetch() requests that mimic Next's RSC prefetch (same headers).
 *
 * The responses land in the browser's HTTP cache. When React later
 * hydrates and router.prefetch() runs for the same URL + headers, the
 * browser serves from HTTP cache in ms. A click that arrives before
 * router.prefetch() has run benefits too: the in-flight HTTP fetch
 * finishes and warms the cache while the user is still deciding.
 *
 * Tenant slug is resolved at runtime from location.pathname (first path
 * segment) — cheap, always available at parse time, no server-side
 * async work needed. Non-tenant URLs (/login, /signup, /) produce a
 * slug that doesn't match the hot-routes pattern and are skipped.
 *
 * Placed in the ROOT layout (src/app/layout.tsx) rather than the (app)
 * layout so it fires BEFORE the (app) layout's async auth work
 * completes. That was the key finding: (app) layout's async fetches
 * were delaying HTML emit (and therefore this script) by ~2.6 s.
 */

// Heuristic: tenant slugs used in Nexpura look like `maison-jove` or
// `intake-1776553836`, so they contain a hyphen. Flat app routes (like
// "login", "signup", "pricing") do not. This keeps us from noisy
// prefetching on non-authenticated pages.
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

export function PrehydrationPrefetch() {
  const js = `
(function(){try{
  var seg=location.pathname.split('/')[1];
  if(!seg||seg.indexOf('-')<0)return;
  var h=${JSON.stringify(HOT_ROUTES)};
  for(var i=0;i<h.length;i++){
    fetch('/'+seg+'/'+h[i],{headers:{'rsc':'1','next-router-prefetch':'1'},credentials:'include'}).catch(function(){});
  }
}catch(e){}})()`.trim();

  return (
    // eslint-disable-next-line react/no-danger
    <script dangerouslySetInnerHTML={{ __html: js }} />
  );
}
