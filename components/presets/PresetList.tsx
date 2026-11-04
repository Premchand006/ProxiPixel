"use client";

import { useState } from "react";
import { deletePreset } from "@/server/presets";
import { useToast } from "@/lib/app/toast";

export interface PresetItem {
  id: string;
  tool: string;
  name: string;
  createdAt: string;
}

export function PresetList({ initial }: { initial: PresetItem[] }) {
  const { toast } = useToast();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function onDelete(id: string): Promise<void> {
    setBusy(id);
    const res = await deletePreset(id);
    setBusy(null);
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      toast("Preset deleted.", "success");
    } else {
      toast(res.error ?? "Could not delete preset.", "error");
    }
  }

  if (rows.length === 0) {
    return <div className="empty">No presets yet.</div>;
  }

  return (
    <ul className="presetlist">
      {rows.map((p) => (
        <li key={p.id} className="presetrow">
          <span className="presettool">{p.tool}</span>
          <span className="presetname">{p.name}</span>
          <span className="navspacer" />
          <button
            className="ghost"
            disabled={busy === p.id}
            onClick={() => void onDelete(p.id)}
          >
            {busy === p.id ? "Deleting…" : "Delete"}
          </button>
        </li>
      ))}
    </ul>
  );
}
