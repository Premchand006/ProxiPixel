"use client";

import { useState } from "react";
import { createShare } from "@/server/shares";
import { useToast } from "@/lib/app/toast";

export function ShareButton({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  async function onShare(): Promise<void> {
    setBusy(true);
    const res = await createShare(jobId);
    setBusy(false);
    if (res.ok && res.slug) {
      const url = `${window.location.origin}/s/${res.slug}`;
      setLink(url);
      try {
        await navigator.clipboard.writeText(url);
        toast("Share link copied to clipboard.", "success");
      } catch {
        toast("Share link created.", "success");
      }
    } else {
      toast(res.error ?? "Could not create a share link.", "error");
    }
  }

  if (link) {
    return (
      <input
        className="sharelink"
        readOnly
        value={link}
        aria-label="Share link"
        onFocus={(e) => e.currentTarget.select()}
      />
    );
  }

  return (
    <button
      type="button"
      className="ghost"
      disabled={busy}
      onClick={() => void onShare()}
    >
      {busy ? "…" : "Share"}
    </button>
  );
}
