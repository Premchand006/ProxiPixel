import * as Sentry from "@sentry/nextjs";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    // See the comment in sentry.edge.config.ts: this runs inside the
    // middleware's edge runtime on every request, so a load/init failure
    // here must never take the middleware down with it.
    try {
      await import("./sentry.edge.config");
    } catch (err) {
      console.error("Sentry edge module failed to load — continuing without it", err);
    }
  }
}

// Reports errors from Server Components, Server Actions, and middleware.
// A no-op when Sentry isn't initialized (no DSN configured).
export const onRequestError = Sentry.captureRequestError;
