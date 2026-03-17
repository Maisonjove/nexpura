import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable turbopack for build to avoid middleware.js.nft.json issue
  experimental: {
    turbo: undefined,
  },
};

export default nextConfig;
