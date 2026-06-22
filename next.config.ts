import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
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

const sentryConfig = withSentryConfig(nextConfig, {
  org: "deeptrack",
  project: "deeptrack-gotham-enterprise",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    reactComponentAnnotation: {
      enabled: true,
    },
    treeshake: {
      removeDebugLogging: true,
    },
  },
});

export default sentryConfig;