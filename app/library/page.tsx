import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listJobs } from "@/server/jobs";
import type { JobRecord } from "@/server/queries";
import {
  SIGNED_URL_TTL_SECONDS,
  STORAGE_BUCKET,
} from "@/server/output-helpers";
import { formatBytes } from "@/lib/app/types";
import { ShareButton } from "@/components/library/ShareButton";

export const metadata: Metadata = { title: "Library · ProxiPixel" };
export const dynamic = "force-dynamic";

function when(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString();
}

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/library");

  let rows: JobRecord[] = [];
  let dbError = false;
  try {
    rows = await listJobs();
  } catch {
    dbError = true;
  }

  // Sign saved outputs (owner-scoped; RLS lets a user read their own folder).
  const signed: Record<string, string> = {};
  for (const j of rows) {
    if (!j.outputPath) continue;
    const { data } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(j.outputPath, SIGNED_URL_TTL_SECONDS);
    if (data?.signedUrl) signed[j.id] = data.signedUrl;
  }

  return (
    <main className="wrap">
      <h1 className="pagetitle">Library</h1>
      <p className="pagesub">
        Job history for <b>{user.email}</b>. Files stay on your device — only
        metadata is saved, plus any outputs you explicitly save to storage.
      </p>

      {dbError ? (
        <div className="empty">
          History is unavailable — the database isn’t configured yet.
        </div>
      ) : rows.length === 0 ? (
        <div className="empty">
          Nothing saved yet. Run a job on the home page while signed in.
        </div>
      ) : (
        <div className="history">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Tool</th>
                <th>Output</th>
                <th>Size</th>
                <th>When</th>
                <th>Saved</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id}>
                  <td className="hname" title={j.sourceName}>
                    {j.sourceName}
                  </td>
                  <td>{j.kind}</td>
                  <td>{j.targetFormat ?? "—"}</td>
                  <td>{j.outputSize ? formatBytes(j.outputSize) : "—"}</td>
                  <td>{when(j.createdAt)}</td>
                  <td className="savedcell">
                    {signed[j.id] ? (
                      <>
                        <a
                          className="navcta"
                          href={signed[j.id]}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                        <ShareButton jobId={j.id} />
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
