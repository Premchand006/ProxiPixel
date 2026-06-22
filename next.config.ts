import type { NextConfig } from "next";

// CDN/runtime origins the engine fetches from (encoders, FFmpeg core/worker,
// pdf.js) plus Supabase (auth/storage/realtime). Kept in sync with
// lib/engine/loaders.ts.
const CDN_ORIGINS =
  "https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com";
const SUPABASE_ORIGINS = "https://*.supabase.co https://*.supabase.in wss://*.supabase.co";

// Next's dev server (React Fast Refresh) needs 'unsafe-eval'; production does not.
const devEval = process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : "";

const csp = [
  `default-src 'self'`,
  // 'unsafe-inline' for Next's hydration scripts; 'wasm-unsafe-eval' for
  // FFmpeg.wasm; CDN origins for the optional encoders/decoders.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${devEval} blob: ${CDN_ORIGINS}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `media-src 'self' data: blob:`,
  `font-src 'self' data:`,
  `worker-src 'self' blob:`,
  `connect-src 'self' data: blob: ${CDN_ORIGINS} ${SUPABASE_ORIGINS}`,
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
    return config;
  },
  // Lint the server + test code too (outside next lint's default dir set).
  eslint: { dirs: ["app", "components", "lib", "server", "tests"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
