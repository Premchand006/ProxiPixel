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

function Header() {
  return (
    <header className="top">
      <div className="brand">
        <div className="wordmark">
          <Image src="/logo.png" alt="" width={36} height={36} className="wordmarklogo" priority />
          PROXIPIXEL
        </div>
        <div className="tagline">
          Convert, upscale, optimize and de-watermark images right in your
          browser. Files never leave your device.
        </div>
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
        <b>4K upscaling.</b> Defaults to 4K UHD (3840px long edge): gamma-correct
        Lanczos in linear light, then a thresholded Gaussian sharpen for crisp edges
        without halos. Enlarges existing detail; doesn’t invent it.
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
        XLSX · CSV · ODS both ways (PPTX import). PDF is text-only:
        layout, images and fonts don’t survive the round trip. Everything runs
        in your browser and nothing is uploaded.
      </div>
      <div className="note">
        <b>Metadata stripped.</b> Every image export is decoded and re-encoded
        locally, so EXIF data (GPS, camera, timestamps) is removed. Cards flag
        source location data.
      </div>
    </div>
  );
}

function StudioLayout() {
  const { mode } = useStudio();
  return (
    <div className="wrap">
      <Header />
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
      <footer>
        ProxiPixel · Image, video, document and PDF tools that run in your
        browser
      </footer>
      <CompareModal />
      <VideoModal />
    </div>
  );
}

export function Studio() {
  return (
    <StudioProvider>
      <StudioLayout />
    </StudioProvider>
  );
}
