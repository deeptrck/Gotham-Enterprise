import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // DO NOT put server-only secrets (CLERK_SECRET_KEY, MONGODB_URI, etc.) in the `env` block.
  // The `env` block is for build-time constants that get inlined into the CLIENT bundle.
  // Putting secrets there exposes them to the browser and can also cause Clerk to
  // resolve keys incorrectly after credential rotation.
  //
  // Server-only env vars (CLERK_SECRET_KEY, MONGODB_URI, etc.) are read automatically
  // by Next.js / Clerk from process.env at runtime — just keep them in .env.local.
  //
  // Only NEXT_PUBLIC_* vars need to be here if you want them available client-side
  // without the NEXT_PUBLIC_ prefix. Since we use them with the prefix, nothing is needed.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: "deeptrack",
  project: "deeptrack-gotham-enterprise",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});