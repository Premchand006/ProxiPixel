"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

/**
 * Root-level error boundary — catches errors in the root layout itself,
 * which app/error.tsx can't (it's rendered inside the layout it would need
 * to replace). Sentry.captureException no-ops when Sentry isn't initialized.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <main className="statewrap">
          <h1 className="pagetitle">Something went wrong</h1>
          <p className="pagesub" style={{ marginInline: "auto" }}>
            An unexpected error occurred. Your files never left your device.
          </p>
        </main>
      </body>
    </html>
  );
}
