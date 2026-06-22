import type { Metadata } from "next";
import { getDb } from "@/server/db";
import { selectJobByIdAny, selectShareBySlug } from "@/server/queries";
import {
  isShareExpired,
  secondsUntil,
  SIGNED_URL_TTL_SECONDS,
  STORAGE_BUCKET,
} from "@/server/output-helpers";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Shared output · ProxiPixel" };
export const dynamic = "force-dynamic";

interface Resolved {
  url: string | null;
  reason: "ok" | "not-found" | "expired" | "unavailable";
  format?: string | null;
}

async function resolveShare(slug: string): Promise<Resolved> {
  try {
    const db = getDb();
    const now = new Date();
    const share = await selectShareBySlug(db, slug);
    if (!share) return { url: null, reason: "not-found" };
    if (isShareExpired(share.expiresAt, now))
      return { url: null, reason: "expired" };

    const job = await selectJobByIdAny(db, share.jobId);
    if (!job?.outputPath) return { url: null, reason: "unavailable" };

    // No session here — sign with the service role (server-only). Cap the URL
    // lifetime to whatever is left of the share so it can't outlive expiry.
    const ttl = Math.max(
      60,
      Math.min(SIGNED_URL_TTL_SECONDS, secondsUntil(share.expiresAt, now)),
    );
    const admin = createAdminClient();
    const { data } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(job.outputPath, ttl);
    if (!data?.signedUrl) return { url: null, reason: "unavailable" };
    return { url: data.signedUrl, reason: "ok", format: job.targetFormat };
  } catch {
    return { url: null, reason: "unavailable" };
  }
}

const MESSAGE: Record<Exclude<Resolved["reason"], "ok">, string> = {
  "not-found": "This share link doesn’t exist.",
  expired: "This share link has expired.",
  unavailable: "This shared output is unavailable.",
};

const IMAGE_FORMATS = new Set([
  "png",
  "jpeg",
  "webp",
  "avif",
  "bmp",
  "gif",
  "tiff",
]);

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await resolveShare(slug);

  return (
    <main className="authwrap">
      <div className="authcard">
        <h1 className="authtitle">Shared output</h1>
        {res.reason !== "ok" || !res.url ? (
          <p className="authsub">{MESSAGE[res.reason as "not-found"]}</p>
        ) : (
          <>
            <p className="authsub">
              Someone shared a ProxiPixel output with you. This link expires.
            </p>
            {res.format && IMAGE_FORMATS.has(res.format) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sharepreview" src={res.url} alt="Shared output" />
            )}
            <a className="run sharedl" href={res.url} download>
              Download
            </a>
          </>
        )}
      </div>
    </main>
  );
}
