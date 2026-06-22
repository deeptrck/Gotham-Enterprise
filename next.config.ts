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