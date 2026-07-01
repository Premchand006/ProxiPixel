/**
 * Generates the deterministic sample fixtures used by the e2e conversion tests.
 * Run with `node e2e/fixtures/generate.mjs`. Rasters come from `sharp`, BMP is
 * hand-encoded (sharp can't write it), and office docs come from the app's own
 * `docx`/`xlsx` dependencies. Formats sharp/Node can't synthesize (HEIC, PDF,
 * video, ODT, PPTX) are fetched by `download.mjs`. `sharp` is a transient
 * dev-only generation tool and is removed during repo cleanup — the produced
 * fixtures are committed, so this script need not run in CI.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const XLSX = require("xlsx");
const JSZip = require("jszip");
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");

const DIR = dirname(fileURLToPath(import.meta.url));
const out = (name) => join(DIR, name);
const W = 96;
const H = 64;

/** A content-rich RGB source: gradients + a checker so lossy codecs have work. */
function rawRGB() {
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const checker = (((x >> 3) ^ (y >> 3)) & 1) * 40;
      buf[i] = Math.round((x / W) * 255); // R gradient →
      buf[i + 1] = Math.round((y / H) * 255) ^ checker; // G gradient ↓ + checker
      buf[i + 2] = 128 + checker; // B checker
    }
  }
  return buf;
}

/** Minimal uncompressed 24-bit BMP (BI_RGB, bottom-up, BGR, 4-byte rows). */
function encodeBMP(rgb, w, h) {
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const pix = rowSize * h;
  const size = 14 + 40 + pix;
  const buf = Buffer.alloc(size);
  let p = 0;
  buf.write("BM", p);
  p = 2;
  buf.writeUInt32LE(size, p); p += 4;
  buf.writeUInt32LE(0, p); p += 4;
  buf.writeUInt32LE(54, p); p += 4;
  buf.writeUInt32LE(40, p); p += 4;
  buf.writeInt32LE(w, p); p += 4;
  buf.writeInt32LE(h, p); p += 4;
  buf.writeUInt16LE(1, p); p += 2;
  buf.writeUInt16LE(24, p); p += 2;
  buf.writeUInt32LE(0, p); p += 4;
  buf.writeUInt32LE(pix, p); p += 4;
  buf.writeInt32LE(2835, p); p += 4;
  buf.writeInt32LE(2835, p); p += 4;
  buf.writeUInt32LE(0, p); p += 4;
  buf.writeUInt32LE(0, p); p += 4;
  for (let y = 0; y < h; y++) {
    const sy = h - 1 - y;
    let off = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const s = (sy * w + x) * 3;
      buf[off++] = rgb[s + 2];
      buf[off++] = rgb[s + 1];
      buf[off++] = rgb[s];
    }
  }
  return buf;
}

async function main() {
  const raw = rawRGB();
  const base = () => sharp(raw, { raw: { width: W, height: H, channels: 3 } });
  const made = [];

  const rasters = [
    ["sample.png", base().png()],
    ["sample.jpg", base().jpeg({ quality: 90 })],
    ["sample.webp", base().webp({ quality: 90 })],
    ["sample.avif", base().avif({ quality: 60 })],
    ["sample.gif", base().gif()],
    // Uncompressed: the app decodes TIFF with UTIF, which handles plain/LZW
    // reliably but not JPEG-in-TIFF (sharp's default for RGB input).
    ["sample.tiff", base().tiff({ compression: "none" })],
  ];
  for (const [name, pipe] of rasters) {
    const buf = await pipe.toBuffer();
    writeFileSync(out(name), buf);
    made.push(`${name} (${buf.length}B)`);
  }

  writeFileSync(out("sample.bmp"), encodeBMP(raw, W, H));
  made.push("sample.bmp");

  // ---- watermark fixture: dark image with a bright bottom-right "stamp" that
  // the Gemini removal engine's corner reconstruction repairs (mirrors the
  // darkWithCornerStamp case in tests/engine/watermark.test.ts). ----
  {
    const w = 1300;
    const h = 820;
    const wm = Buffer.alloc(w * h * 3, 12); // near-black
    const cx = w - 70;
    const cy = h - 60;
    const r = 26;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const d = (Math.abs(x - cx) + Math.abs(y - cy)) / r;
        if (d > 1) continue;
        const a = Math.pow(1 - d, 0.6);
        const v = Math.round(12 * (1 - a) + 240 * a);
        const i = (y * w + x) * 3;
        wm[i] = wm[i + 1] = wm[i + 2] = v;
      }
    }
    const buf = await sharp(wm, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
    writeFileSync(out("sample_wm.png"), buf);
    made.push("sample_wm.png");
  }

  // ---- text documents ----
  writeFileSync(
    out("sample.txt"),
    "ProxiPixel fixture\nLine two with some words.\nLine three.\n",
  );
  writeFileSync(
    out("sample.md"),
    "# Title\n\nA **bold** paragraph with _italic_ text and a [link](https://example.com).\n\n- one\n- two\n\n## Section\n\nMore text.\n",
  );
  writeFileSync(
    out("sample.html"),
    "<!doctype html><html><head><meta charset=utf-8><title>Fixture</title></head><body><h1>Title</h1><p>A <b>bold</b> paragraph.</p><ul><li>one</li><li>two</li></ul></body></html>\n",
  );
  writeFileSync(out("sample.csv"), "name,qty,price\nApples,5,1.20\nPears,3,0.90\nLimes,12,0.30\n");
  writeFileSync(
    out("sample.rtf"),
    "{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\f0\\fs24 Fixture title\\par A bold {\\b word} and an italic {\\i word}.\\par Third line.\\par}",
  );
  made.push("sample.txt/md/html/csv/rtf");

  // ---- office documents via the app's own deps ----
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Fixture Title")] }),
          new Paragraph({ children: [new TextRun("A paragraph with "), new TextRun({ text: "bold", bold: true }), new TextRun(" and "), new TextRun({ text: "italic", italics: true }), new TextRun(" text.")] }),
          new Paragraph({ children: [new TextRun("Second paragraph of the fixture document.")] }),
        ],
      },
    ],
  });
  writeFileSync(out("sample.docx"), await Packer.toBuffer(doc));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ["name", "qty", "price"],
    ["Apples", 5, 1.2],
    ["Pears", 3, 0.9],
    ["Limes", 12, 0.3],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  writeFileSync(out("sample.xlsx"), XLSX.write(wb, { bookType: "xlsx", type: "buffer" }));
  writeFileSync(out("sample.ods"), XLSX.write(wb, { bookType: "ods", type: "buffer" }));
  made.push("sample.docx/xlsx/ods");

  // ---- ODT (text) — shaped to match odtToHtml() in lib/docs/convert.ts ----
  const odtContent =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
    'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">' +
    "<office:body><office:text>" +
    '<text:h text:outline-level="1">Fixture Title</text:h>' +
    "<text:p>A paragraph in the ODT fixture.</text:p>" +
    "<text:p>Second paragraph.</text:p>" +
    "</office:text></office:body></office:document-content>";
  const odtManifest =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">' +
    '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>' +
    '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>' +
    "</manifest:manifest>";
  const odt = new JSZip();
  odt.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });
  odt.file("content.xml", odtContent);
  odt.file("META-INF/manifest.xml", odtManifest);
  writeFileSync(out("sample.odt"), await odt.generateAsync({ type: "nodebuffer" }));

  // ---- PPTX — shaped to match pptxToHtml() (reads ppt/slides/slideN.xml a:t) ----
  const slide = (lines) =>
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>' +
    lines
      .map(
        (t) =>
          "<p:sp><p:txBody><a:p><a:r><a:t>" + t + "</a:t></a:r></a:p></p:txBody></p:sp>",
      )
      .join("") +
    "</p:spTree></p:cSld></p:sld>";
  const pptx = new JSZip();
  pptx.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
  );
  pptx.file("ppt/slides/slide1.xml", slide(["Fixture Slide One", "Bullet text"]));
  pptx.file("ppt/slides/slide2.xml", slide(["Second Slide"]));
  writeFileSync(out("sample.pptx"), await pptx.generateAsync({ type: "nodebuffer" }));
  made.push("sample.odt/pptx");

  // ---- PDF — minimal but valid 1-page doc with text + a filled rectangle ----
  writeFileSync(out("sample.pdf"), buildPdf());
  made.push("sample.pdf");

  console.log("generated:\n  " + made.join("\n  "));
}

/** Hand-build a minimal valid single-page PDF (correct xref offsets). */
function buildPdf() {
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 160]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    "<</Length 69>>\nstream\nBT /F1 20 Tf 24 110 Td (Fixture PDF) Tj ET\n0 0 1 rg 24 30 152 50 re f\nendstream",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
