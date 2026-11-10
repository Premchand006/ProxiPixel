import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_NAME, siteUrl } from "./site";

/**
 * Shared 1200×630 social card for every indexable page. Rendered at build
 * time (all callers are static), so the file read and Satori cost nothing
 * per request.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

let logoData: Promise<string> | undefined;
function logo(): Promise<string> {
  logoData ??= readFile(join(process.cwd(), "public/icon-512.png")).then(
    (b) => `data:image/png;base64,${b.toString("base64")}`,
  );
  return logoData;
}

export async function renderOgImage(opts: {
  eyebrow: string;
  title: string;
  subtitle: string;
}): Promise<ImageResponse> {
  const src = await logo();
  const host = new URL(siteUrl()).host;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "#0f1117",
        backgroundImage:
          "radial-gradient(circle at 88% 12%, rgba(52,224,216,0.22), transparent 42%), radial-gradient(circle at 8% 100%, rgba(255,92,158,0.20), transparent 46%)",
        color: "#eaecf2",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={src} width={72} height={72} style={{ borderRadius: 16 }} />
        <div
          style={{
            display: "flex",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: -0.5,
          }}
        >
          {SITE_NAME.toUpperCase()}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "#34e0d8",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {opts.eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 66,
            fontWeight: 700,
            lineHeight: 1.08,
            maxWidth: 1000,
          }}
        >
          {opts.title}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#9aa1b2",
            maxWidth: 980,
            lineHeight: 1.35,
          }}
        >
          {opts.subtitle}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 20px",
            border: "1px solid #2a2f3d",
            borderRadius: 999,
            background: "#161922",
            color: "#eaecf2",
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              background: "#5be8a6",
            }}
          />
          Runs locally · no uploads · free
        </div>
        <div style={{ display: "flex", color: "#6b7280" }}>{host}</div>
      </div>
    </div>,
    OG_SIZE,
  );
}
