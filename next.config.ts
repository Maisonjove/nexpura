import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Static security headers applied to every response. CSP, X-Content-Type-
// Options, Referrer-Policy, and the framing controls are set in
// middleware.ts (the authoritative owner — middleware's response headers
// overwrite these anyway). Kept here: headers that never change per
// request and don't conflict with middleware.
const securityHeaders = [
  // HSTS - 2 years with preload (max security)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Prevent MIME type confusion attacks
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
];

const nextConfig: NextConfig = {
  // cacheComponents enabled globally. Preview branch proved 360/360 pages
  // generate cleanly with this flag and the segment-config exports stripped.
  cacheComponents: true,
  // Stable, deterministic build ID derived from the deploy SHA.
  //
  // C-06 fix — RSC version skew:
  // Next's default `generateBuildId` produces a random opaque string per
  // build, so a client bundle from Deploy A and the RSC payload from
  // Deploy B don't share an identity the runtime can compare. The
  // built-in `x-deployment-id` mismatch detection works on Vercel for
  // first-party fetches, but the SW (public/sw.js) proxies RSC requests
  // via the Cache API — that means a stale-cached RSC response can be
  // served to a client that already loaded the new HTML, with neither
  // side flagging skew.
  //
  // Deriving the build ID from VERCEL_GIT_COMMIT_SHA gives us:
  //   1. The same `build-<sha12>` token that scripts/inject-sw-version.mjs
  //      writes into the SW's CACHE_VERSION → SW cache and Next's build
  //      ID share a single key.
  //   2. A predictable `process.env.NEXT_PUBLIC_BUILD_ID` value the
  //      client can read at build time and compare against the
  //      `x-deployment-id` response header on every fetch.
  //   3. Determinism — re-deploying the same SHA produces the same
  //      build ID, so a redeploy without code change doesn't trigger
  //      a spurious skew banner.
  //
  // Local dev: returning `null` lets Next generate its random per-dev-server
  // ID. The DeployVersionBanner is a no-op in development anyway.
  async generateBuildId() {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    if (sha && sha.length > 0) return `build-${sha.slice(0, 12)}`;
    return null;
  },
  // C-06 verification finding (2026-05-05). Two-pass fix:
  //
  // First pass added `deploymentId: build-<sha12>` here so Next would
  // emit `x-deployment-id`. Vercel rejected the build:
  //   "The NEXT_DEPLOYMENT_ID environment variable value 'dpl_xxx' does
  //    not match the provided deploymentId 'build-<sha12>' in the config"
  // — Vercel auto-injects NEXT_DEPLOYMENT_ID and Next refuses any
  // explicit `deploymentId` that conflicts with it. We can't anchor
  // skew detection on a SHA-derived token from inside this file alone.
  //
  // Second pass (this one): align the client-side anchor and the
  // header the client reads with the surface Vercel actually provides:
  //   - server emits `x-nextjs-deployment-id: dpl_xxx` natively
  //     (no `deploymentId` config needed; Vercel does it)
  //   - client reads `NEXT_PUBLIC_BUILD_ID = NEXT_DEPLOYMENT_ID` at
  //     build time (Vercel auto-injects this; we just expose it)
  //   - DeployVersionBanner reads `x-nextjs-deployment-id` from the
  //     response (matches what the server emits; same `dpl_xxx` value)
  //
  // `generateBuildId` is kept — it owns the build artifact's SHA-based
  // identity for the SW cache key (scripts/inject-sw-version.mjs).
  // The skew-detection layer is intentionally a different anchor:
  // SW cache eviction is per-build-artifact; skew detection is per-
  // Vercel-deploy. They are different invariants.
  //
  // Tradeoff acknowledged: re-deploying the same Git SHA on Vercel
  // produces a fresh `dpl_xxx`, so the banner will fire on the
  // already-loaded client. That's acceptable — a soft reload after a
  // promotional redeploy is a benign UX cost, and the reload-blocker
  // registry preserves in-progress state.
  env: {
    // Expose Vercel's deploy ID to client code at build time. Reading
    // `process.env.NEXT_PUBLIC_BUILD_ID` from a client component returns
    // the inlined string token. Falls back to empty string (banner stays
    // dormant) when there's no Vercel deploy context — local dev, etc.
    NEXT_PUBLIC_BUILD_ID: process.env.NEXT_DEPLOYMENT_ID ?? "",
  },
  experimental: {
    clientTraceMetadata: ["baggage", "sentry-trace"],
    // NOTE: Next 16 replaced `experimental.ppr` with a different caching
    // model (`cacheComponents: true` at the top level + `use cache` directives
    // on cached components + `unstable_instant` per-route). That's a bigger
    // migration than this pass is taking on. We've kept the prerequisite
    // groundwork in place — (app)/layout.tsx is synchronous, and the target
    // pages have zero top-level awaits with all dynamic work inside Suspense —
    // so when we flip `cacheComponents: true`, these routes are already
    // correctly structured for instant navigation.
    // App Router client-side route cache lifetime.
    //
    // Default (Next 15+) is `dynamic: 0` — dynamic routes are NOT cached
    // client-side, so every in-session nav re-fetches the RSC payload.
    // That forces a full round-trip even though the prefetcher just warmed
    // the route seconds ago.
    //
    // With tag-based invalidation wired from every mutating action
    // (customers/tasks/inventory/invoices/repairs/bespoke/sales),
    // revalidateTag() and revalidatePath() correctly purge cached entries
    // as soon as any write happens in the same session. So we can safely
    // extend the idle cache lifetime.
    //
    // dynamic: 120 — a jeweller moving between customer → their repair →
    // back to customer → their invoice over 1-2 min of active work gets
    // warm route entry on every nav. After 2 min of idle, the next click
    // re-fetches (acceptable fresh-read cost after meaningful elapsed time).
    //
    // static: 300 — 5 min for layouts / loading.tsx / truly-static segments,
    // which change rarely.
    //
    // Trade-off: if two users on separate tabs edit the same tenant's
    // data, one tab may see the other's change up to 120s late. For a
    // single-user workflow (the typical jeweller's shop) this is invisible;
    // for multi-staff concurrent edits the staleness window is bounded and
    // mutations on *your own* tab are always fresh via revalidatePath/Tag.
    staleTimes: {
      dynamic: 120,
      static: 300,
    },
    // Tree-shake large barrel-export packages so only the icons/components
    // actually imported end up in the client bundle.
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@radix-ui/react-icons",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@hugeicons/react",
      "@hugeicons/core-free-icons",
      "framer-motion",
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async redirects() {
    // Legacy / aliased URLs — handled at the edge before middleware so
    // neither auth redirects nor cacheComponents prerender logic can
    // interfere. Each pair exists for both the flat and tenant-prefixed
    // shape because TopNav / Supabase middleware rewrite `/{slug}/{route}`
    // to `/{route}` internally, but the user-typed URL is whatever they
    // bookmarked and we want every shape to land somewhere sensible.
    return [
      // /bespoke/approve/{token} — legacy path for the bespoke approval
      // link. Canonical route is /approve/{token}. Without this redirect
      // the request falls through Supabase auth middleware (which treats
      // "bespoke" as a tenant app route) and dumps the customer on the
      // staff login form.
      { source: "/bespoke/approve/:token", destination: "/approve/:token", permanent: false },
      // Settings aliases — orphan URLs that used to look like 404s.
      { source: "/settings/users", destination: "/settings/team", permanent: false },
      { source: "/:slug/settings/users", destination: "/:slug/settings/team", permanent: false },
      { source: "/settings/profile", destination: "/settings", permanent: false },
      { source: "/:slug/settings/profile", destination: "/:slug/settings", permanent: false },
      // /settings/email-domain already redirects onward to /settings/email,
      // so save a hop and target the canonical directly.
      { source: "/settings/email-domains", destination: "/settings/email", permanent: false },
      { source: "/:slug/settings/email-domains", destination: "/:slug/settings/email", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          // Enable DNS prefetching for faster external resource resolution
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      // Aggressive caching for static assets (1 year, immutable)
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache icons and manifest for PWA
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      // Cache fonts for 1 year
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Stale-while-revalidate for API routes (faster perceived response)
      {
        source: "/api/dashboard/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, max-age=0, stale-while-revalidate=30",
          },
        ],
      },
      // NOTE: An earlier attempt set Cache-Control: private, max-age=15 +
      // Vary: cookie here for hot-route RSC prefetch requests. Verified via
      // e2e/cache-probe.spec.ts: the override DID apply to 307 redirects
      // (unauth → /login) but was OVERWRITTEN by Next's renderer on
      // authenticated 200 responses. The renderer sets
      // `Cache-Control: private, no-cache, no-store, max-age=0,
      // must-revalidate` after next.config.ts headers() run, so browser
      // HTTP cache never retains the response. The win for first-click
      // reuse actually comes from the Service Worker (public/sw.js) which
      // caches these responses via cacheFirstStrategy and ignores
      // Cache-Control. Vary augmentation is therefore needed at a layer
      // Next does NOT overwrite — moved to middleware.ts (see
      // `augmentVaryForHotPrefetch`).
    ];
  },
  // Enable gzip/brotli compression to reduce egress bandwidth
  compress: true,
  // Keep heavy server-only packages out of the client bundle
  serverExternalPackages: [
    "@react-pdf/renderer",
    "puppeteer-core",
    "exceljs",
    "postgres",
  ],
  images: {
    // Serve modern image formats for smaller file sizes and faster loads
    formats: ["image/avif", "image/webp"],
    // Cache optimised images for 24 h at the CDN edge
    minimumCacheTTL: 86400,
    remotePatterns: [
      // Supabase Storage -- covers all project buckets
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Supabase CDN (used by some Supabase-hosted assets)
      {
        protocol: "https",
        hostname: "*.supabase.in",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,
  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: true,
  // Automatically annotate React components to show their full name in breadcrumbs
  reactComponentAnnotation: {
    enabled: true,
  },
  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers
  tunnelRoute: "/monitoring",
  // Hides source maps from generated client bundles
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  // Enables automatic instrumentation of Vercel Cron Monitors
  automaticVercelMonitors: true,
});
