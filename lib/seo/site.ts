/**
 * Single source of truth for everything search engines, social cards and AI
 * crawlers see: site identity, per-tool landing pages and the curated set of
 * format-conversion pages. Page metadata, the sitemap, JSON-LD, llms.txt and
 * the on-page guides all read from here, so they can never drift apart.
 *
 * Plain data only (no React, no Node APIs): it's imported by Server
 * Components, metadata routes and client components alike.
 */
import type { Mode } from "@/lib/app/types";
import type { ImageFormat } from "@/lib/engine/types";

export const SITE_NAME = "ProxiPixel";

export const SITE_TAGLINE = "Private media tools that run in your browser";

export const SITE_DESCRIPTION =
  "Convert, upscale and compress images, transcode video, convert documents and edit PDFs in your browser. Free, no sign-up, and files never leave your device.";

export const REPO_URL = "https://github.com/Premchand006/ProxiPixel";

/** Theme colours, mirrored from the --ink token in app/globals.css. */
export const THEME_COLOR = { light: "#f5f6fa", dark: "#0f1117" } as const;

/**
 * Absolute origin of the deployment, without a trailing slash. Canonical URLs,
 * the sitemap, robots.txt, JSON-LD and social cards are all built from it, so
 * a wrong value silently points search engines elsewhere. In order:
 *
 * 1. NEXT_PUBLIC_SITE_URL, when set explicitly
 * 2. Netlify's URL (the site's primary URL, also on deploy previews, so
 *    previews canonicalize to production)
 * 3. Vercel's VERCEL_PROJECT_PRODUCTION_URL (a bare host)
 * 4. localhost, for local builds
 */
export function siteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw =
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    env.URL?.trim() ||
    (vercel ? `https://${vercel.replace(/^https?:\/\//, "")}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface QA {
  q: string;
  a: string;
}

export interface ToolPage {
  mode: Mode;
  /** Route path. The Convert tool lives on the home page. */
  path: string;
  /** Short name used in navigation, breadcrumbs and the footer. */
  name: string;
  /** <title> text, before the " | ProxiPixel" template suffix. */
  title: string;
  /** Meta description, 120–160 characters. */
  description: string;
  /** Visible page heading. */
  h1: string;
  /** One-sentence summary shown under the heading. */
  lead: string;
  keywords: string[];
  steps: string[];
  features: string[];
  formats: string;
  questions: QA[];
}

const PRIVACY_QA: QA = {
  q: "Are my files uploaded anywhere?",
  a: "No. Files are decoded, processed and encoded by your own browser using the Canvas API and WebAssembly. Nothing is sent to a server unless you are signed in and click Save on a specific result.",
};

export const TOOLS: Record<Mode, ToolPage> = {
  convert: {
    mode: "convert",
    path: "/",
    name: "Image converter",
    title: "Private Image Converter & Media Tools",
    description:
      "Convert images between PNG, JPG, WebP, AVIF, HEIC, TIFF, GIF and PDF right in your browser. Free, no sign-up, no uploads: files never leave your device.",
    h1: "Free image converter that never uploads your files",
    lead: "Change an image's format without compressing or resizing it, entirely on your device.",
    keywords: [
      "image converter",
      "convert image format",
      "heic to jpg",
      "webp to png",
      "png to jpg",
      "private image converter",
    ],
    steps: [
      "Drop, paste or pick one or more images (HEIC, TIFF and PDF pages included).",
      "Choose the output format and, for JPG, WebP or AVIF, the quality.",
      "Press Convert, then download each result or everything as a ZIP.",
    ],
    features: [
      "Batch conversion with per-file progress and one-click ZIP export",
      "Before/after compare slider for every result",
      "EXIF metadata (GPS, camera, timestamps) is stripped on re-encode",
      "Each PDF page becomes its own image",
    ],
    formats:
      "Input: PNG, JPG, WebP, AVIF, BMP, GIF, TIFF, HEIC/HEIF and PDF. Output: PNG, JPG, WebP, AVIF, BMP, GIF, TIFF and PDF.",
    questions: [
      PRIVACY_QA,
      {
        q: "Does converting reduce image quality?",
        a: "Converting to PNG, TIFF or BMP is lossless. JPG, WebP and AVIF are lossy formats, so you pick a quality level; 90% is visually identical to the original for most photos.",
      },
      {
        q: "Why can't I export AVIF?",
        a: "AVIF encoding depends on your browser. Chrome and Edge can encode it; if yours can't, the tool tells you and you can choose WebP, which is widely supported.",
      },
    ],
  },
  upscale: {
    mode: "upscale",
    path: "/image-upscaler",
    name: "Image upscaler",
    title: "Free 4K Image Upscaler, Private and In-Browser",
    description:
      "Upscale images to 4K UHD with gamma-correct Lanczos resampling, denoise and halo-free sharpening. Runs in your browser: no uploads, no sign-up, free.",
    h1: "Upscale images to 4K in your browser",
    lead: "Enlarge photos and graphics up to 3840 px on the long edge with sharpening, without sending them anywhere.",
    keywords: [
      "image upscaler",
      "upscale image to 4k",
      "enlarge image",
      "increase image resolution",
      "lanczos upscaling",
    ],
    steps: [
      "Add the images you want to enlarge.",
      "Pick 4K UHD, a fixed multiple (1.5× to 4×) or a custom width, and tune denoise, clarity and sharpening.",
      "Press Upscale and compare the result against the original with the slider.",
    ],
    features: [
      "Lanczos (a = 3) resampling in linear light so colours stay accurate",
      "Optional denoise before enlarging so noise isn't magnified",
      "Noise-gated clarity that avoids amplifying JPEG blocking",
      "Thresholded sharpening that crisps edges without halos",
    ],
    formats:
      "Any supported image in; PNG, JPG, WebP, AVIF, BMP, GIF, TIFF or PDF out.",
    questions: [
      PRIVACY_QA,
      {
        q: "Is this AI upscaling?",
        a: "No. It uses classical, deterministic resampling and sharpening. It makes existing detail larger and crisper, but it doesn't invent detail the way a generative super-resolution model does, so it never hallucinates faces or text.",
      },
      {
        q: "What is the largest size I can upscale to?",
        a: "Up to 3840 px on the long edge (4K UHD). Very large outputs use a lot of memory, so phones may be slower than desktops.",
      },
    ],
  },
  optimize: {
    mode: "optimize",
    path: "/image-compressor",
    name: "Image compressor",
    title: "Compress Images to a Target Size in KB, Free",
    description:
      "Compress JPG, PNG and WebP images to a quality level or an exact size in KB, with AVIF and WebP output and an optional width cap. Private and in-browser.",
    h1: "Compress images to a quality or an exact size in KB",
    lead: "Shrink images for the web, email or upload limits. A binary search finds the best quality that fits your target size.",
    keywords: [
      "image compressor",
      "compress image to 100kb",
      "reduce image size",
      "compress jpg",
      "avif compressor",
    ],
    steps: [
      "Add your images.",
      "Choose Quality mode, or Size mode and enter a target in KB. Optionally cap the width.",
      "Press Optimize; each card shows the saving and the quality that was used.",
    ],
    features: [
      "Target-size mode searches for the highest quality under your limit",
      "AVIF, WebP and JPG output with an optional maximum width",
      "Shows exact before/after sizes and percentage saved",
      "Metadata is removed, which often saves extra kilobytes",
    ],
    formats:
      "Any supported image in; AVIF, WebP or JPG out (plus the other Convert formats).",
    questions: [
      PRIVACY_QA,
      {
        q: "How do I compress an image to exactly 100 KB?",
        a: "Switch to Size mode and enter 100. The optimizer tries quality levels until it finds the highest one that comes in under 100 KB. If even the lowest quality is too big, cap the width as well.",
      },
      {
        q: "Which format gives the smallest files?",
        a: "AVIF usually produces the smallest file at the same visual quality, followed by WebP and then JPG. Use JPG when you need the widest compatibility.",
      },
    ],
  },
  watermark: {
    mode: "watermark",
    path: "/gemini-watermark-remover",
    name: "Gemini watermark remover",
    title: "Remove the Gemini Watermark from AI Images",
    description:
      "Remove the visible Gemini logo from AI-generated images by exactly reversing its alpha blend. No generative fill, no uploads, and lossless at native sizes.",
    h1: "Remove the visible Gemini watermark, losslessly",
    lead: "Strip Gemini's corner logo by solving the alpha-blend equation for the original pixels, not by painting over them.",
    keywords: [
      "gemini watermark remover",
      "remove gemini watermark",
      "gemini logo remover",
      "ai image watermark",
    ],
    steps: [
      "Add images generated by Gemini (PNG, JPG or WebP).",
      "Press Remove; the tool locates the mark from Gemini's known output sizes.",
      "Use the compare slider to check the corner, then download.",
    ],
    features: [
      "Reverse alpha blending with calibrated alpha maps, not inpainting",
      "Lossless at Gemini's native output sizes",
      "Local re-fit cleans faint residue on resized images",
      "Works on batches, entirely offline once loaded",
    ],
    formats: "PNG, JPG and WebP in and out.",
    questions: [
      PRIVACY_QA,
      {
        q: "Does this remove SynthID?",
        a: "No. Only the visible corner logo is removed. Invisible watermarks such as SynthID are embedded in the image signal and are not affected.",
      },
      {
        q: "Why is the result exact instead of blurred?",
        a: "Gemini composites its logo with standard alpha blending. Knowing the logo and its alpha map, the original pixel equals (watermarked − α·logo) / (1 − α), so the tool recovers it directly instead of guessing.",
      },
    ],
  },
  video: {
    mode: "video",
    path: "/video-converter",
    name: "Video converter",
    title: "Video Converter, Trimmer and GIF Maker",
    description:
      "Convert video to MP4, WebM or GIF, trim clips, crop to an aspect ratio, change frame rate and mute audio with FFmpeg running in your browser. No uploads.",
    h1: "Convert, trim and crop video in your browser",
    lead: "FFmpeg compiled to WebAssembly does the work locally, so even long clips never leave your device.",
    keywords: [
      "video converter",
      "mp4 to gif",
      "mov to mp4",
      "trim video online",
      "webm converter",
    ],
    steps: [
      "Add a video (MP4, MOV, WebM, MKV and more).",
      "Pick MP4 (H.264), WebM (VP9) or GIF, then set trim points, crop, frame rate or mute.",
      "Press Convert. FFmpeg loads once (about 31 MB) and is cached for next time.",
    ],
    features: [
      "MP4 (H.264), WebM (VP9) and animated GIF output",
      "Trim by start and end time, crop to common aspect ratios",
      "Change frame rate and remove the audio track",
      "Inline preview of the finished clip",
    ],
    formats: "MP4, MOV, WebM, MKV, AVI, M4V and more in; MP4, WebM or GIF out.",
    questions: [
      PRIVACY_QA,
      {
        q: "Why is the first conversion slower?",
        a: "The first time you use the Video tool, the browser downloads FFmpeg.wasm (about 31 MB) from this site. After that it's cached, and conversion speed depends on your device.",
      },
      {
        q: "How do I turn a video into a GIF?",
        a: "Choose GIF as the output, trim to the part you want and lower the frame rate if the file is large. Short clips of a few seconds make the best GIFs.",
      },
    ],
  },
  documents: {
    mode: "documents",
    path: "/document-converter",
    name: "Document converter",
    title: "Convert Word, PDF, Markdown, Excel and CSV",
    description:
      "Convert DOCX, ODT, RTF, PDF, Markdown, HTML and TXT, plus XLSX, CSV and ODS spreadsheets, in either direction. Runs in your browser with no uploads.",
    h1: "Convert documents and spreadsheets without uploading them",
    lead: "Two-way conversion between Word, Markdown, HTML, plain text and PDF, and between Excel, CSV and ODS, with tables bridging the two.",
    keywords: [
      "document converter",
      "docx to markdown",
      "markdown to docx",
      "xlsx to csv",
      "csv to excel",
      "html to markdown",
    ],
    steps: [
      "Add a document or spreadsheet.",
      "Pick the target format from the list of conversions that file supports.",
      "Convert and download. Batches export as a ZIP.",
    ],
    features: [
      "Documents: DOCX, ODT, RTF, PDF, Markdown, HTML and TXT",
      "Spreadsheets: XLSX, CSV and ODS",
      "Table bridge: convert an XLSX sheet to Markdown or an HTML table to CSV",
      "PowerPoint (.pptx) text import",
    ],
    formats:
      "DOCX, ODT, RTF, PDF, MD, HTML, TXT, XLSX, CSV and ODS in both directions; PPTX as input.",
    questions: [
      PRIVACY_QA,
      {
        q: "Does PDF conversion keep the layout?",
        a: "No. PDF conversion is text-based: headings, paragraphs and lists come through, but page layout, images and fonts do not. For layout-exact work, use the PDF tools instead.",
      },
      {
        q: "Can I export PowerPoint files?",
        a: "Not yet. .pptx files can be imported as text, but exporting to .pptx or legacy .ppt isn't supported.",
      },
    ],
  },
  pdftools: {
    mode: "pdftools",
    path: "/pdf-tools",
    name: "PDF tools",
    title: "Merge, Split and Rotate PDF Pages Privately",
    description:
      "Merge PDFs, split or extract pages, remove, reorder and rotate pages, crop margins and add page numbers, all in your browser. Free, private and no sign-up.",
    h1: "Merge, split and edit PDF pages in your browser",
    lead: "Rearrange and combine PDFs page by page with pdf-lib, without uploading a single file.",
    keywords: [
      "merge pdf",
      "split pdf",
      "rotate pdf pages",
      "add page numbers to pdf",
      "reorder pdf pages",
      "private pdf editor",
    ],
    steps: [
      "Add one or more PDF files.",
      "Choose an action: merge, split, remove, extract, reorder, rotate, crop margins or number pages.",
      "Preview the page order and download the new PDF.",
    ],
    features: [
      "Merge any number of PDFs in the order you choose",
      "Split into single pages or extract a page range",
      "Rotate, remove and reorder individual pages",
      "Crop margins and stamp page numbers",
    ],
    formats: "PDF in, PDF out.",
    questions: [
      PRIVACY_QA,
      {
        q: "Can I edit the text inside a PDF?",
        a: "No. These tools work on whole pages: combining, splitting, rotating and numbering them. They don't change or reflow the text on a page.",
      },
      {
        q: "Is there a page or file limit?",
        a: "There's no artificial limit. Very large PDFs are bounded only by your device's memory.",
      },
    ],
  },
};

/** Tools in navigation order. */
export const TOOL_LIST: ToolPage[] = [
  TOOLS.convert,
  TOOLS.upscale,
  TOOLS.optimize,
  TOOLS.watermark,
  TOOLS.video,
  TOOLS.documents,
  TOOLS.pdftools,
];

/** Tools with their own route (everything except Convert, which is "/"). */
export const ROUTED_TOOLS = TOOL_LIST.filter((t) => t.path !== "/");

export function toolBySlug(slug: string): ToolPage | undefined {
  return ROUTED_TOOLS.find((t) => t.path === `/${slug}`);
}

// ---------------------------------------------------------------------------
// Format conversion pages (/convert/<from>-to-<to>)
// ---------------------------------------------------------------------------

export interface ConvertPair {
  slug: string;
  fromLabel: string;
  toLabel: string;
  /** Output format preselected in the Convert tool. */
  to: ImageFormat;
  title: string;
  description: string;
  h1: string;
  lead: string;
  /** Things specific to this pair that a user should know. */
  notes: string[];
}

function pair(
  from: string,
  to: ImageFormat,
  toLabel: string,
  description: string,
  lead: string,
  notes: string[],
): ConvertPair {
  return {
    slug: `${from.toLowerCase()}-to-${toLabel.toLowerCase()}`,
    fromLabel: from,
    toLabel,
    to,
    title: `${from} to ${toLabel} Converter, Free and Private`,
    description,
    h1: `Convert ${from} to ${toLabel} in your browser`,
    lead,
    notes,
  };
}

/**
 * A deliberately small, curated set: high-intent pairs where each page has
 * something specific to say. Not a format × format matrix.
 */
export const CONVERT_PAIRS: ConvertPair[] = [
  pair(
    "HEIC",
    "jpeg",
    "JPG",
    "Convert iPhone HEIC photos to JPG in your browser. Batch convert, strip location data and download a ZIP. Free, no sign-up, and no uploads.",
    "Turn iPhone and iPad photos into JPGs that open everywhere, without sending your camera roll to a server.",
    [
      "HEIC is the default photo format on iPhones since iOS 11. Many Windows apps, websites and printers still can't open it; JPG works everywhere.",
      "iPhone photos usually carry GPS coordinates. Re-encoding removes EXIF data, and each card flags files that had a location embedded.",
      "A quality of 90% keeps photos visually identical while staying close to the original HEIC file size.",
    ],
  ),
  pair(
    "HEIC",
    "png",
    "PNG",
    "Convert HEIC images to lossless PNG without uploading them. Ideal for editing iPhone photos and screenshots. Free, private and runs in your browser.",
    "Get a lossless PNG from an iPhone HEIC file, ready for editing software that doesn't read HEIC.",
    [
      "PNG is lossless, so nothing is lost on conversion, but expect files several times larger than the HEIC original.",
      "Choose PNG over JPG when you plan to edit the image further and want to avoid compounding compression.",
      "For Live Photos, the still image is converted; the motion clip is a separate file and isn't affected.",
    ],
  ),
  pair(
    "WebP",
    "png",
    "PNG",
    "Convert WebP images to PNG with transparency preserved. Batch convert in your browser with no uploads, no watermark and no sign-up.",
    "Save WebP images from the web as PNGs that older editors and apps can open, keeping any transparency.",
    [
      "Transparent WebP images stay transparent: PNG supports a full alpha channel.",
      "Animated WebP files are converted as a single still frame.",
      "If the WebP was lossy, the PNG preserves exactly what you see but can't restore detail lost earlier.",
    ],
  ),
  pair(
    "WebP",
    "jpeg",
    "JPG",
    "Convert WebP to JPG for apps and sites that don't accept WebP. Pick the quality, batch convert and download a ZIP. Private and in-browser.",
    "Turn WebP downloads into JPGs that upload forms, email clients and older software accept.",
    [
      "JPG has no transparency, so transparent areas are flattened onto white.",
      "Use a quality of 85–92% for photos; lower values shrink files at the cost of visible artefacts.",
      "Batch-convert a whole folder of WebP images at once and download them as one ZIP.",
    ],
  ),
  pair(
    "PNG",
    "jpeg",
    "JPG",
    "Convert PNG to JPG to shrink screenshots and photos for email and the web. Adjustable quality, batch support and no uploads. Free and private.",
    "Make large PNG photos and screenshots small enough to email or upload, right on your device.",
    [
      "PNG is lossless and can be huge for photographs; JPG is often 5–10× smaller at a quality you won't notice.",
      "JPG has no transparency, so transparent areas turn white. Keep logos and icons as PNG or WebP instead.",
      "For text-heavy screenshots, a high quality (90%+) keeps lettering sharp.",
    ],
  ),
  pair(
    "JPG",
    "png",
    "PNG",
    "Convert JPG to PNG for lossless editing and further processing. Batch convert in your browser: no uploads, no sign-up and no watermark.",
    "Switch a JPG to lossless PNG before editing, so further saves don't add new compression artefacts.",
    [
      "Converting to PNG stops further quality loss, but it can't remove artefacts already in the JPG.",
      "PNG files are larger. That's expected: the format stores every pixel exactly.",
      "Camera metadata such as GPS location is dropped during conversion.",
    ],
  ),
  pair(
    "PNG",
    "webp",
    "WebP",
    "Convert PNG to WebP for faster websites. Smaller files with transparency kept, adjustable quality and batch support. Private, in your browser.",
    "Cut page weight by serving WebP instead of PNG, with transparency intact.",
    [
      "WebP supports transparency, so it's a drop-in replacement for PNG logos and UI graphics.",
      "Lossy WebP at 80–90% is typically far smaller than PNG for photographic content.",
      "All modern browsers support WebP, which helps Core Web Vitals such as LCP.",
    ],
  ),
  pair(
    "JPG",
    "webp",
    "WebP",
    "Convert JPG to WebP to make images smaller for the web at the same visual quality. Batch convert privately in your browser with no uploads.",
    "Re-encode JPG photos as WebP for lighter pages and faster loading.",
    [
      "WebP is usually 25–35% smaller than JPG at similar visual quality.",
      "Start at 80% quality and use the compare slider to check for visible differences.",
      "For an exact file-size budget, use the image compressor's target-size mode instead.",
    ],
  ),
  pair(
    "AVIF",
    "jpeg",
    "JPG",
    "Convert AVIF images to JPG for apps that can't open AVIF yet. Adjustable quality and batch export, all in your browser with no uploads.",
    "Make AVIF images usable in older software, upload forms and editors that only understand JPG.",
    [
      "AVIF is very efficient, so the JPG will usually be larger for the same visual quality.",
      "Decoding uses your browser's built-in AVIF support, available in all current major browsers.",
      "Transparent AVIF areas are flattened onto white, since JPG has no alpha channel.",
    ],
  ),
  pair(
    "TIFF",
    "jpeg",
    "JPG",
    "Convert TIFF scans and camera files to JPG in your browser. Shrink huge files for sharing with adjustable quality. Free, private, no uploads.",
    "Turn large TIFF scans and exports into shareable JPGs without installing anything.",
    [
      "TIFF files from scanners and cameras are often uncompressed; a JPG can be a small fraction of the size.",
      "TIFFs are decoded locally with UTIF. For multi-page TIFFs, the first page is converted.",
      "Keep the TIFF original for archiving and use the JPG for sharing.",
    ],
  ),
  pair(
    "PDF",
    "jpeg",
    "JPG",
    "Convert PDF pages to JPG images in your browser. Every page becomes its own image, with batch ZIP download. Free, private, no uploads.",
    "Render each page of a PDF to a JPG image, ready for slides, chats or social posts.",
    [
      "Every page becomes a separate JPG, numbered in page order.",
      "Pages are rendered locally with pdf.js, so confidential documents stay on your device.",
      "Need a lossless page image instead? Pick PNG as the output.",
    ],
  ),
  pair(
    "JPG",
    "pdf",
    "PDF",
    "Convert JPG images to PDF in your browser. Each image becomes a page sized to fit. Free, private and no uploads, with batch support.",
    "Wrap photos, receipts and scans in a PDF that any device can open and print.",
    [
      "Each image becomes a one-page PDF sized to fit the picture.",
      "To combine several images into one document, convert them, then merge the PDFs with the PDF tools.",
      "Location metadata from phone photos is removed in the process.",
    ],
  ),
];

export function pairBySlug(slug: string): ConvertPair | undefined {
  return CONVERT_PAIRS.find((p) => p.slug === slug);
}

export function pairPath(p: ConvertPair): string {
  return `/convert/${p.slug}`;
}
