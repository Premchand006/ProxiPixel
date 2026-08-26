// Server-side (Node runtime) Sentry init — server actions, RSC. No-op when
// NEXT_PUBLIC_SENTRY_DSN isn't set (see sentry.client.config.ts).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });
}
