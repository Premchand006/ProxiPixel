import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPresets } from "@/server/presets";
import { PresetList, type PresetItem } from "@/components/presets/PresetList";

export const metadata: Metadata = { title: "Presets · ProxiPixel" };
export const dynamic = "force-dynamic";

export default async function PresetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/presets");

  let items: PresetItem[] = [];
  let dbError = false;
  try {
    const rows = await listPresets();
    items = rows.map((p) => ({
      id: p.id,
      tool: p.tool,
      name: p.name,
      createdAt: p.createdAt.toISOString(),
    }));
  } catch {
    dbError = true;
  }

  return (
    <main className="wrap">
      <h1 className="pagetitle">Presets</h1>
      <p className="pagesub">
        Saved tool settings for <b>{user.email}</b>. Save and load them from the
        Presets bar on the home page; delete them here.
      </p>
      {dbError ? (
        <div className="empty">
          Presets are unavailable — the database isn’t configured yet.
        </div>
      ) : (
        <PresetList initial={items} />
      )}
    </main>
  );
}
