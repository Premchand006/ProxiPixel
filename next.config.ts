import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Supabase origins (auth/storage/realtime) — the only third party the app
// ever talks to at runtime. Every media library (FFmpeg.wasm, pdf.js, gifenc,
// utif, jspdf) is vendored same-origin (see lib/engine/loaders.ts and
// tools/vendor-assets.mjs) — nothing fetches code from a third-party CDN.
const SUPABASE_ORIGINS = "https://*.supabase.co https://*.supabase.in wss://*.supabase.co";

// Only allowlisted when actually configured — derived from the real DSN
// (not a wildcarded guess) so CSP stays tight when Sentry isn't set up.
const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ORIGIN = sentryDsn ? new URL(sentryDsn).origin : "";

// Next's dev server (React Fast Refresh) needs 'unsafe-eval'; production does not.
const devEval = process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : "";

const csp = [
  `default-src 'self'`,
  // 'unsafe-inline' for Next's hydration scripts; 'wasm-unsafe-eval' for
  // FFmpeg.wasm.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${devEval} blob:`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `media-src 'self' data: blob:`,
  `font-src 'self' data:`,
  `worker-src 'self' blob:`,
  `connect-src 'self' data: blob: ${SUPABASE_ORIGINS}${SENTRY_ORIGIN ? ` ${SENTRY_ORIGIN}` : ""}`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep the Postgres driver out of the bundle; load it as a native node module
  // in server actions / RSC.
  serverExternalPackages: ["postgres"],
  // The document converters (pptxgenjs/jszip/etc.) reference Node built-ins for
  // code paths we never hit in the browser (e.g. pptxgenjs fetching remote
  // images over node:https). Resolve those to empty modules in the client bundle.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      const empty: Record<string, false> = {};
      for (const m of ["fs", "https", "http", "zlib", "stream", "url", "crypto", "path"]) {
        empty[m] = false;
        empty[`node:${m}`] = false;
      }
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = { ...config.resolve.fallback, ...empty };
      config.resolve.alias = { ...config.resolve.alias, ...empty };
    }
    // pdfjs-dist uses top-level await; every browser this app supports
    // (evergreen Chrome/Firefox/Edge/Safari) has supported it since 2021.
    // Both flags are needed to quiet webpack's conservative default-target
    // warning — `experiments.topLevelAwait` enables the feature, but
    // webpack's warning is driven by `output.environment.asyncFunction`.
    config.experiments = { ...config.experiments, topLevelAwait: true };
    config.output.environment = {
      ...config.output.environment,
      asyncFunction: true,
    };
    return config;
  },
  // Lint the server + test code too (outside next lint's default dir set).
  eslint: { dirs: ["app", "components", "lib", "server", "tests"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Vendored FFmpeg.wasm assets (see tools/vendor-assets.mjs) — fixed
        // filenames (not content-hashed), so cache for a week rather than
        // Next's usual immutable/1y: a version bump needs old cached copies
        // to expire within a bounded window, not be pinned forever.
        source: "/vendor/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, must-revalidate" },
        ],
      },
    ];
  },
};

// Sentry's build wrapper needs org/project (and, for source-map upload, an
// auth token) — all sourced from the account the user sets up, not something
// this repo can assume. Skip it entirely when unconfigured so the build is
// identical to a plain Next.js build until Sentry is actually wired up.
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;

export default sentryOrg && sentryProject
  ? withSentryConfig(nextConfig, {
      org: sentryOrg,
      project: sentryProject,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
    })
  : nextConfig;
