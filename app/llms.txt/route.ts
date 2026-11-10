import {
  CONVERT_PAIRS,
  REPO_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  TOOL_LIST,
  absoluteUrl,
  pairPath,
} from "@/lib/seo/site";

// llms.txt (https://llmstxt.org): a plain-Markdown map of the site for AI
// assistants. Generated from the same data as the pages, so it can't go stale.
export const dynamic = "force-static";

export function GET(): Response {
  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "All processing happens on the visitor's device with the Canvas API and WebAssembly (FFmpeg.wasm, pdf.js, pdf-lib). Files are never uploaded. No account is needed; an optional account adds job history, presets and a private library.",
    "",
    "## Tools",
    "",
    ...TOOL_LIST.map(
      (t) =>
        `- [${t.name}](${absoluteUrl(t.path)}): ${t.description} Formats: ${t.formats}`,
    ),
    "",
    "## Format conversions",
    "",
    ...CONVERT_PAIRS.map(
      (p) =>
        `- [${p.fromLabel} to ${p.toLabel}](${absoluteUrl(pairPath(p))}): ${p.lead}`,
    ),
    "",
    "## Limitations",
    "",
    "- Upscaling is classical resampling and sharpening, not generative AI; it doesn't invent detail.",
    "- The watermark remover only removes Gemini's visible corner logo, not invisible watermarks such as SynthID.",
    "- Document conversion to and from PDF is text-based; layout, images and fonts are not preserved.",
    "- PDF tools work on whole pages and don't edit the text inside a page.",
    "",
    "## Optional",
    "",
    `- [Source code](${REPO_URL}): MIT-licensed Next.js app.`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
