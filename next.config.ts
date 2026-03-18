import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack for production builds to avoid edge-case chunking errors
  experimental: {
    turbo: {
      // Turbopack config if needed in the future
    },
  },
};

export default nextConfig;
