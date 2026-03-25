import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Enable gzip/brotli compression to reduce egress bandwidth
  compress: true,
  // Keep heavy server-only packages out of the client bundle
  serverExternalPackages: ['@react-pdf/renderer', 'puppeteer-core', 'xlsx', 'postgres'],
  images: {
    remotePatterns: [
      // Supabase Storage — covers all project buckets
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

export default nextConfig;
