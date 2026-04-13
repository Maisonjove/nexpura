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
    // Tree-shake large barrel-export packages so only the icons/components
    // actually imported end up in the client bundle.
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@radix-ui/react-icons",
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
