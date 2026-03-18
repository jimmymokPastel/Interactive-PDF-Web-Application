import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack config (used in Next.js 16 by default)
  // The `canvas` alias silences the optional peer-dep warning from pdfjs-dist
  // when running in the browser bundle.
  turbopack: {
    resolveAlias: {
      canvas: { browser: "./src/lib/empty.ts" },
    },
  },
  // Keep webpack config for non-Turbopack environments
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
