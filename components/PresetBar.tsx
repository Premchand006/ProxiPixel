"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useStudio } from "@/lib/app/store";
import { useToast } from "@/lib/app/toast";
import { createClient } from "@/lib/supabase/client";
import { listPresets, savePreset } from "@/server/presets";
import type {
  ConvertOptions,
  OptimizeUIOptions,
  UpscaleUIOptions,
  WatermarkUIOptions,
} from "@/lib/app/types";
import type { VideoOptions } from "@/lib/engine/types";

interface PresetLite {
  id: string;
  tool: string;
  name: string;
  settings: Record<string, unknown>;
}

export function PresetBar() {
  const { mode, options, setConvert, setUp, setOp, setWm, setVid } =
    useStudio();
  const { toast } = useToast();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [presets, setPresets] = useState<PresetLite[]>([]);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const rows = (await listPresets()) as PresetLite[];
    setPresets(rows);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const isIn = !!data.user;
      setSignedIn(isIn);
      if (isIn) void refresh();
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const current = presets.filter((p) => p.tool === mode);

  const currentSettings = (): Record<string, unknown> => {
    const s =
      mode === "convert"
        ? options.convert
        : mode === "upscale"
          ? options.up
          : mode === "optimize"
            ? options.op
            : mode === "watermark"
              ? options.wm
              : options.vid;
    return s as unknown as Record<string, unknown>;
  };

  function applyPreset(p: PresetLite): void {
    const s = p.settings;
    if (p.tool === "convert") setConvert(s as Partial<ConvertOptions>);
    else if (p.tool === "upscale") setUp(s as Partial<UpscaleUIOptions>);
    else if (p.tool === "optimize") setOp(s as Partial<OptimizeUIOptions>);
    else if (p.tool === "watermark") setWm(s as Partial<WatermarkUIOptions>);
    else if (p.tool === "video") setVid(s as Partial<VideoOptions>);
  }

  async function onSave(): Promise<void> {
    const name = window.prompt("Name this preset")?.trim();
    if (!name) return;
    setSaving(true);
    const res = await savePreset({ tool: mode, name, settings: currentSettings() });
    setSaving(false);
    if (res.ok) {
      void refresh();
      toast(`Saved preset “${name}”.`, "success");
    } else {
      toast(res.error ?? "Could not save preset.", "error");
    }
  }

  if (signedIn === null) return null;

  if (!signedIn) {
    return (
      <div className="presetbar">
        <span className="presethint">
          <Link href="/login" className="navcta">
            Sign in
          </Link>{" "}
          to save presets &amp; job history.
        </span>
      </div>
    );
  }

  return (
    <div className="presetbar">
      <span className="presetlabel">Presets</span>
      {current.length > 0 ? (
        <select
          className="presetselect"
          aria-label="Load preset"
          defaultValue=""
          onChange={(e) => {
            const p = current.find((x) => x.id === e.target.value);
            if (p) applyPreset(p);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Load a preset…
          </option>
          {current.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="presethint">No presets for this tab yet.</span>
      )}
      <button className="ghost" onClick={() => void onSave()} disabled={saving}>
        {saving ? "Saving…" : "Save current"}
      </button>
      <span className="navspacer" />
      <Link href="/presets" className="navlink">
        Manage
      </Link>
    </div>
  );
}
