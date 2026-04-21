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
  // cacheComponents enabled globally. Preview branch proved 360/360 pages
  // generate cleanly with this flag and the segment-config exports stripped.
  cacheComponents: true,
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
