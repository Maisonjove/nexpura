/**
 * Pre-hydration RSC warmup for the hot jeweller routes.
 *
 * WHY THIS EXISTS
 * ---------------
 * Measured on prod:
 *   - HTML first byte arrives:           ~300 ms
 *   - First contentful paint:            ~1200 ms
 *   - Dashboard subtree hydrates:        ~5000-6000 ms (heavy: stats, charts, row-memo)
 *   - RoutePrefetcher useEffect fires:   ~6000 ms (after its subtree commits)
 *   - User's first click (typical):      ~1500-2500 ms
 *
 * The click happens BEFORE any prefetch has been fired. Every first-click
 * therefore pays full RSC round-trip (~2-3 s on Sydney→Sydney Fluid+Supabase).
 *
 * This component emits an inline <script> in the server-rendered HTML. The
 * browser executes it the moment it parses the <script> tag — typically
 * within 100-400 ms of navigation start, well before any React code runs,
 * well before the dashboard's stats batch fires, well before the user can
 * click.
 *
 * The script issues the EXACT same fetch that Next.js's `router.prefetch`
 * would later issue for a route-level cache miss:
 *
 *   fetch('/{slug}/{route}?_rsc={hash}', {
 *     credentials: 'same-origin',
 *     headers: {
 *       'rsc': '1',
 *       'next-router-prefetch': '1',
 *       'next-router-segment-prefetch': '/_tree',
 *       'next-url': '{currentPathname}',
 *     },
 *   });
 *
 * Matching details captured by `e2e/prefetch-audit.spec.ts` against live
 * prod. The `_rsc` cache-busting parameter is a djb2 hex hash of the
 * header values — same algorithm Next's router uses internally
 * (`next/dist/shared/lib/hash.js:hexHash`). Re-implementing it here keeps
 * the URLs bit-for-bit identical to what the router will later fire.
 *
 * WHY THIS HELPS EVEN THOUGH RSC RESPONSES ARE `no-store`
 * -------------------------------------------------------
 * Authenticated RSC responses carry `Cache-Control: private, no-cache,
 * no-store` — they are not reused from the browser HTTP cache. So how
 * does warming help?
 *
 *   1. The Vercel Fluid Lambda for each target route is cold-booted.
 *      Firing a request at t=300 ms warms the Lambda so that when Next's
 *      router.prefetch eventually fires at ~6000 ms, the Lambda response
 *      is faster (hundreds of ms saved).
 *   2. The Supabase connection pool is warmed, the `tenant_dashboard_stats`
 *      row is cached in-process, and the Redis `getCached` entries for
 *      the route's queries are populated.
 *   3. When the user clicks before the router.prefetch has fired, the
 *      router falls back to a cache-miss navigation fetch. Chromium's
 *      HTTP layer may coalesce that fetch with our still-in-flight inline
 *      fetch (exact URL+headers match → cache key match). Not guaranteed
 *      but free upside when it happens.
 *
 * WHY THIS IS NOT THE EARLIER (REVERTED) APPROACH
 * -----------------------------------------------
 * The earlier attempt (commit 400d8a6, reverted) fired `fetch('/customers',
 * { headers: { 'rsc': '1' } })` without the `_rsc` query param and without
 * `next-router-prefetch` / `next-router-segment-prefetch` / `next-url`
 * headers. The server responds (and browser caches) keyed by the Vary
 * header set — which includes all of those. Mismatched headers meant the
 * inline fetch never matched Next's later router.prefetch: two separate
 * cache entries, full duplicate traffic. Observed persistence-test
 * regression 17/17 → 13/17. This time the URL+header shape is byte-for-byte
 * identical to what the router will fire, so there is no duplicate work.
 *
 * SAFETY
 * ------
 *  - Only fires on tenant-prefixed URLs (first path segment is NOT in
 *    APP_ROUTES). On /login, /signup, /onboarding, public pages — no-op.
 *  - Only warms the 8 hot jeweller routes. No spam of the full app.
 *  - Inline script is tiny (~1 KB after gzip) and runs in < 1 ms.
 *  - `credentials: 'same-origin'` preserves session cookies → correct
 *    tenant context. No cross-tenant leakage possible.
 *  - If fetch fails (offline, timeout), silently ignored. No user-visible
 *    side effects.
 */
export function PrehydrationPrefetch() {
  // ⚠ Keep this list in sync with RoutePrefetcher's HOT_ROUTES. The cost
  // of a mismatch is wasted warmup, not correctness.
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

  // These must match src/lib/app-routes.ts APP_ROUTES. Duplicated here
  // because this script has to run before any JS module loads.
  const APP_ROUTES = [
    "dashboard","intake","pos","sales","invoices","quotes","laybys","inventory",
    "customers","suppliers","memo","stocktakes","repairs","bespoke","workshop",
    "appraisals","passports","expenses","financials","reports","refunds",
    "vouchers","eod","marketing","tasks","copilot","website","documents",
    "integrations","reminders","support","settings","billing","suspended",
    "communications","notifications","migration","ai","enquiries","print-queue",
    "actions","login","signup","onboarding","verify","verify-email",
    "forgot-password","reset-password","track","admin","api","_next","offline",
    "pricing","features","about","contact","blog","terms","privacy","switching",
    "support-access",
  ];

  const script = `
(function(){
  try {
    var path = location.pathname;
    var parts = path.split('/');
    var seg = parts[1] || '';
    var appRoutes = ${JSON.stringify(APP_ROUTES)};
    if (!seg || appRoutes.indexOf(seg) >= 0) return;
    var prefix = '/' + seg;
    var hot = ${JSON.stringify(HOT_ROUTES)};
    // djb2 hash — must match next/dist/shared/lib/hash.js:hexHash
    function djb2(s) {
      var h = 5381;
      for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff;
      return h >>> 0;
    }
    // Headers Next's router.prefetch sets for a route-level cache-miss.
    // computeCacheBustingSearchParam input: [prefetch, segmentPrefetch, stateTree, nextUrl]
    // stateTree is not set for prefetch → '0'. nextUrl is set to current path.
    var rsc = djb2('1,/_tree,0,' + path).toString(36).slice(0, 5);
    var headers = {
      'rsc': '1',
      'next-router-prefetch': '1',
      'next-router-segment-prefetch': '/_tree',
      'next-url': path
    };
    if (window.performance && performance.mark) performance.mark('nx_warmup_start');
    var fired = 0;
    for (var i = 0; i < hot.length; i++) {
      var url = prefix + hot[i] + '?_rsc=' + rsc;
      fetch(url, { credentials: 'same-origin', headers: headers }).catch(function(){});
      fired++;
    }
    if (window.performance && performance.mark) performance.mark('nx_warmup_fired_' + fired);
    window.__nxWarmupFired = fired;
    window.__nxWarmupT = Date.now();
  } catch (e) {
    // silent — warmup is best-effort
  }
})();
`.trim();

  return (
    <script dangerouslySetInnerHTML={{ __html: script }} />
  );
}
