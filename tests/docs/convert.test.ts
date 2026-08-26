import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, it } from "vitest";
import { convertDocument } from "@/lib/docs/convert";
import { detectFormat, targetsFor } from "@/lib/docs/formats";
import type { DocFormat } from "@/lib/docs/formats";

// jsdom keeps DOMParser (which the converter needs) but ships a Blob without
// arrayBuffer()/text(). Real browsers have both; swap in Node's Blob so the
// libraries' output blobs are readable here. (convert.ts calls `new Blob` at
// runtime, so this takes effect for all conversions below.)
globalThis.Blob = NodeBlob as unknown as typeof Blob;

// jsdom's File polyfill lacks .text()/.arrayBuffer() (real browsers have them),
// so build a minimal File-like with exactly what the converter reads.
function file(content: string | ArrayBuffer | Uint8Array, name: string): File {
  const buf =
    typeof content === "string"
      ? new TextEncoder().encode(content)
      : content instanceof Uint8Array
        ? content
        : new Uint8Array(content);
  return {
    name,
    text: async () => new TextDecoder().decode(buf),
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  } as unknown as File;
}
async function convert(
  content: string | ArrayBuffer | Uint8Array,
  name: string,
  dst: DocFormat,
): Promise<{ text: string; bytes: Uint8Array; blob: Blob }> {
  const src = detectFormat(name)!;
  const { blob } = await convertDocument(file(content, name), src, dst);
  const ab = await blob.arrayBuffer();
  return { text: new TextDecoder().decode(ab), bytes: new Uint8Array(ab), blob };
}
const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b; // "PK"

describe("formats registry", () => {
  it("detects by extension and excludes legacy .ppt from targets", () => {
    expect(detectFormat("a.MD")).toBe("md");
    expect(detectFormat("a.xlsx")).toBe("xlsx");
    expect(detectFormat("a.unknown")).toBeNull();
    expect(targetsFor("docx")).not.toContain("ppt"); // .ppt can't be written
    expect(targetsFor("docx")).not.toContain("docx"); // no self
    expect(targetsFor("md")).toContain("docx");
  });
});

describe("text & markup conversions", () => {
  it("md → html renders headings and emphasis", async () => {
    const { text } = await convert("# Title\n\nHello **bold** text.", "a.md", "html");
    expect(text).toContain("<h1");
    expect(text.toLowerCase()).toContain("title");
    expect(text).toMatch(/<strong>bold<\/strong>/i);
  });

  it("html → md round-trips structure", async () => {
    const { text } = await convert("<h1>Title</h1><p>Hi <em>there</em></p>", "a.html", "md");
    expect(text).toContain("# Title");
    expect(text).toMatch(/_there_|\*there\*/);
  });

  it("html → txt strips tags but keeps text", async () => {
    const { text } = await convert("<h1>Big</h1><p>line one</p><p>line two</p>", "a.html", "txt");
    expect(text).toContain("Big");
    expect(text).toContain("line one");
    expect(text).not.toContain("<");
  });

  it("txt → rtf produces a valid RTF envelope", async () => {
    const { text } = await convert("hello\nworld", "a.txt", "rtf");
    expect(text.startsWith("{\\rtf1")).toBe(true);
    expect(text).toContain("\\par");
  });

  it("rtf → txt recovers the text", async () => {
    const rtf = "{\\rtf1\\ansi\\deff0 hello\\par world}";
    const { text } = await convert(rtf, "a.rtf", "txt");
    expect(text).toContain("hello");
    expect(text).toContain("world");
  });
});

describe("spreadsheet conversions", () => {
  it("csv → xlsx → csv round-trips the data", async () => {
    const { bytes } = await convert("a,b\n1,2\n3,4", "t.csv", "xlsx");
    expect(isZip(bytes)).toBe(true); // xlsx is a zip
    const back = await convert(bytes, "t.xlsx", "csv");
    expect(back.text.replace(/\r/g, "").trim()).toBe("a,b\n1,2\n3,4");
  });

  it("csv → ods produces a zip", async () => {
    const { bytes } = await convert("x,y\n5,6", "t.csv", "ods");
    expect(isZip(bytes)).toBe(true);
  });

  it("csv → html yields a table", async () => {
    const { text } = await convert("name,age\nAda,36", "t.csv", "html");
    expect(text.toLowerCase()).toContain("<table");
    expect(text).toContain("Ada");
  });

  it("html table → csv extracts rows (cross-family)", async () => {
    const { text } = await convert(
      "<table><tr><td>a</td><td>b</td></tr><tr><td>1</td><td>2</td></tr></table>",
      "t.html",
      "csv",
    );
    expect(text.replace(/\r/g, "").trim()).toBe("a,b\n1,2");
  });
});

describe("PDF conversions", () => {
  // Writer only (jsPDF, no worker involved) — Node-testable. The reader
  // (pdfjs-dist text extraction) needs a real Worker; pdfjs's fake-worker
  // fallback resolves its module URL against `import.meta.url`, which
  // Vitest's Vite-based runner rewrites to an http: URL that Node's ESM
  // loader can't dynamic-import — a test-environment artifact, not a bug (the
  // same `new URL(..., import.meta.url)` pattern already works in the real
  // browser bundle for lib/engine/pdf.ts's PDF→image path). Covered by the
  // "pdf" source in e2e/documents-matrix.spec.ts instead.
  it("md → pdf produces a valid PDF file", async () => {
    const { bytes, blob } = await convert(
      "# Heading\n\nA paragraph of body text.",
      "a.md",
      "pdf",
    );
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(blob.type).toBe("application/pdf");
    expect(bytes.length).toBeGreaterThan(200);
  });
});

describe("office document writers", () => {
  it("md → docx produces a valid (zip) Word file", async () => {
    const { bytes, blob } = await convert("# Heading\n\nA paragraph.", "a.md", "docx");
    expect(isZip(bytes)).toBe(true);
    expect(blob.type).toContain("wordprocessingml");
    expect(bytes.length).toBeGreaterThan(200);
  });

  it("md → odt produces a valid (zip) OpenDocument file", async () => {
    const { bytes } = await convert("# Heading\n\nBody.", "a.md", "odt");
    expect(isZip(bytes)).toBe(true);
  });
});
