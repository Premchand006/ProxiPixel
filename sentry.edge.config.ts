// Edge runtime (middleware) Sentry init. No-op when NEXT_PUBLIC_SENTRY_DSN
// isn't set (see sentry.client.config.ts).
//
// This file runs on every request — middleware.ts has a near-universal
// matcher — so on deploy targets whose "edge" isn't Vercel's (e.g. Netlify's
// middleware runs as a Deno-based Edge Function, not Node.js), an
// incompatibility inside Sentry.init() would take the whole site down. The
// SDK's edge build is written against the portable WinterCG runtime, so this
// should work broadly, but "should" isn't a guarantee across every
// non-Vercel edge runtime — wrapped so a failure here degrades to "no edge
// error tracking," never a broken middleware.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    });
  } catch (err) {
    console.error("Sentry edge init failed — continuing without it", err);
  }
}
