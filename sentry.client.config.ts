// Client-side Sentry init. A no-op when NEXT_PUBLIC_SENTRY_DSN isn't set —
// this file is imported unconditionally by the Sentry Next.js SDK, so the
// guard has to live inside it rather than around the import.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Media processing is local and can be heavy; keep trace volume low in
    // production so a busy tab doesn't spend cycles on sampling overhead.
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
    // No session replay / profiling — this app's "value" is user media,
    // which never leaves the device; recording UI sessions would cut against
    // that even though the media itself is never captured.
  });
}
