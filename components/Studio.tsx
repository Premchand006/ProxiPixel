"use client";

import { StudioProvider, useStudio } from "@/lib/app/store";
import { Tabs } from "./Tabs";
import { DropZone } from "./DropZone";
import { OptionsPanel } from "./OptionsPanel";
import { PresetBar } from "./PresetBar";
import { Queue } from "./Queue";
import { DocumentStudio } from "./DocumentStudio";
import { PdfToolsStudio } from "./PdfToolsStudio";
import { CompareModal } from "./CompareModal";
import { VideoModal } from "./VideoModal";
import Image from "next/image";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Mode } from "@/lib/app/types";
import { ToolGuide } from "./seo/ToolGuide";
import {
  SITE_NAME,
  TOOLS,
  pairBySlug,
  pairPath,
  type ConvertPair,
} from "@/lib/seo/site";
import { documentTitle } from "@/lib/seo/metadata";

function Header({ h1, lead }: { h1: string; lead: string }) {
  return (
    <header className="top">
      <div className="brand">
        <div className="wordmark">
          <Image
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            className="wordmarklogo"
            priority
          />
          PROXIPIXEL
        </div>
        <h1 className="toolh1">{h1}</h1>
        <p className="tagline">{lead}</p>
      </div>
      <div className="privacy">
        <span className="dot" /> Runs locally · no uploads
      </div>
    </header>
  );
}

function Notes() {
  return (
    <div className="notes">
      <div className="note">
        <b>4K upscaling.</b> Defaults to 4K UHD (3840px long edge):
        gamma-correct Lanczos in linear light, then a thresholded Gaussian
        sharpen for crisp edges without halos. Enlarges existing detail; doesn’t
        invent it.
      </div>
      <div className="note">
        <b>Watermark removal.</b> Strips Gemini’s bottom-right logo with exact
        reverse alpha blending. Lossless on known sizes, with a corner re-fit
        for odd dimensions. Only that visible mark is removed.
      </div>
      <div className="note">
        <b>Video.</b> Convert, trim, crop and mute (MP4 / WebM / GIF) via
        FFmpeg.wasm (~31 MB, fetched on first use). Must be served over http(s).
      </div>
      <div className="note">
        <b>Documents.</b> Convert DOCX · ODT · RTF · PDF · MD · HTML · TXT and
        XLSX · CSV · ODS both ways (PPTX import). PDF is text-only: layout,
        images and fonts don’t survive the round trip. Everything runs in your
        browser and nothing is uploaded.
      </div>
      <div className="note">
        <b>Metadata stripped.</b> Every image export is decoded and re-encoded
        locally, so EXIF data (GPS, camera, timestamps) is removed. Cards flag
        source location data.
      </div>
    </div>
  );
}

function StudioLayout({ pair }: { pair?: ConvertPair }) {
  const { mode } = useStudio();
  const tool = TOOLS[mode];
  // A format page (/convert/heic-to-jpg) only describes the Convert tool.
  const activePair = mode === "convert" ? pair : undefined;

  // Keep the address bar and tab title on the landing page for the active
  // tool, so a reload, bookmark or shared link reopens the same tool. Tabs
  // stay in-page (no navigation) so the queued files survive a switch.
  const pathname = usePathname();
  const title = activePair
    ? `${activePair.title} | ${SITE_NAME}`
    : documentTitle(tool);
  useEffect(() => {
    const target = activePair ? pairPath(activePair) : tool.path;
    if (window.location.pathname !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [tool, activePair]);
  // Next re-applies the route's own metadata <title> when replaceState
  // updates its router, so set ours after that commit (keyed on pathname)
  // and once more on the next task in case the metadata lands later.
  useEffect(() => {
    document.title = title;
    const t = window.setTimeout(() => {
      document.title = title;
    }, 0);
    return () => window.clearTimeout(t);
  }, [title, pathname]);

  return (
    <main className="wrap">
      <Header
        h1={activePair?.h1 ?? tool.h1}
        lead={activePair?.lead ?? tool.lead}
      />
      <Tabs />
      {mode === "documents" ? (
        <DocumentStudio />
      ) : mode === "pdftools" ? (
        <PdfToolsStudio />
      ) : (
        <>
          <DropZone />
          <OptionsPanel />
          <PresetBar />
          <Queue />
        </>
      )}
      <Notes />
      <ToolGuide tool={tool} pair={activePair} />
      <CompareModal />
      <VideoModal />
    </main>
  );
}

export function Studio({
  initialMode = "convert",
  pairSlug,
}: {
  initialMode?: Mode;
  /** Slug of a /convert/<pair> page; preselects that output format. */
  pairSlug?: string;
}) {
  const pair = pairSlug ? pairBySlug(pairSlug) : undefined;
  return (
    <StudioProvider initialMode={initialMode} initialConvertFormat={pair?.to}>
      <StudioLayout pair={pair} />
    </StudioProvider>
  );
}
