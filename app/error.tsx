"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console; a real deploy would send this to an error sink.
    console.error(error);
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
