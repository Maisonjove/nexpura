import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const securityHeaders = [
  // HSTS - 2 years with preload (max security)
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Prevent MIME type confusion attacks
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.vercel-scripts.com https://*.supabase.co https://*.sentry.io https://*.sentry-cdn.com https://js.stripe.com https://www.annot8.dev https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://images.unsplash.com https://*.stripe.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.resend.com https://*.sentry.io https://*.ingest.sentry.io https://api.stripe.com https://api.openai.com https://www.annot8.dev",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'self' https://annot8.dev https://*.annot8.dev https://openclaw.ai https://*.openclaw.ai https://astry.agency https://*.astry.agency",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
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
      // ─── Hot-route RSC prefetch — reusable private cache window ───
      //
      // BACKGROUND
      // The pre-hydration inline script (src/components/PrehydrationPrefetch.tsx)
      // fires fetch() for hot tenant-prefixed routes using the exact
      // URL + header shape Next's router.prefetch later fires for the same
      // routes. Without this rule, the authenticated RSC response comes back
      // as `private, no-cache, no-store, max-age=0, must-revalidate` — so the
      // browser's HTTP cache does not retain the response, and when the
      // router's own prefetch fires at hydration time (or the user clicks),
      // the second fetch has to round-trip to origin again. The warmup only
      // warms server state, never the real response bytes.
      //
      // THIS RULE
      // For RSC *prefetch* requests (rsc: 1 AND next-router-prefetch: 1) to
      // hot routes under any tenant slug, override Cache-Control to
      // `private, max-age=15, must-revalidate` and augment Vary so the cache
      // entry is keyed per-browser per-cookie. This lets the warmup response
      // be reused by the router's subsequent prefetch within a 15-second
      // window — the only window that matters for first-click speed.
      //
      // SAFETY
      // - `private` prevents any shared (CDN / proxy) cache from storing.
      // - Match is gated on `rsc: 1` AND `next-router-prefetch: 1` request
      //   headers, so HTML page loads and navigation fetches are UNAFFECTED.
      //   Only the predictable, tenant-scoped prefetch payloads are
      //   cacheable. Never cache a full HTML document.
      // - `Vary: cookie` (augmented to Next's default vary) keys the cache
      //   per cookie bundle. On logout/login, cookies change → new cache
      //   key → no stale user's data served. A different user on the same
      //   browser sees a fresh cache-miss response.
      // - `must-revalidate` prevents stale-serve past the 15s TTL.
      // - 15-second TTL bounds post-write staleness to ≤15s. Writes from
      //   the user themselves invalidate via revalidatePath / revalidateTag
      //   in server actions (already wired in mutating paths), which fires
      //   a `no-store` Next-generated response on the next fetch anyway —
      //   the cache is the *prefetch* response, and Next's render of the
      //   route after a mutation produces fresh data, not cached HTML.
      //
      // SCOPE
      // Hot routes only: customers, repairs, inventory, tasks, invoices,
      // workshop, bespoke, intake. Other routes (settings, billing,
      // marketing, etc.) are untouched and retain Next's default no-store.
      {
        // Base hot-route URLs (e.g. /test/customers, /maisonjove/repairs).
        // These are exactly what the pre-hydration warmup + router.prefetch
        // fire for a route-level cache miss. Subpaths (e.g.
        // /test/customers/new) are NOT matched — their prefetches were
        // never our target.
        source:
          "/:slug/:route(customers|repairs|inventory|tasks|invoices|workshop|bespoke|intake)",
        has: [
          { type: "header", key: "rsc", value: "1" },
          { type: "header", key: "next-router-prefetch", value: "1" },
        ],
        headers: [
          {
            key: "Cache-Control",
            value: "private, max-age=15, must-revalidate",
          },
          {
            // Augment Next's default Vary. Next already sets
            // `rsc, next-router-state-tree, next-router-prefetch,
            // next-router-segment-prefetch`; we add `cookie` to isolate
            // cache entries per authenticated user so logout/login flips
            // the cache key.
            key: "Vary",
            value:
              "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, cookie",
          },
        ],
      },
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
