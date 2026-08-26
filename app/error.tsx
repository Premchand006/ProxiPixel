"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // No-ops when Sentry isn't initialized (NEXT_PUBLIC_SENTRY_DSN unset).
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="statewrap">
      <h1 className="pagetitle">Something went wrong</h1>
      <p className="pagesub" style={{ marginInline: "auto" }}>
        An unexpected error occurred. Your files never left your device.
      </p>
      <button className="run" type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
