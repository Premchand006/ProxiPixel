import type { WorkBook } from "xlsx";
import { FORMATS, type DocFormat } from "./formats";
import { VENDOR } from "../engine/loaders";

/**
 * 100%-local document & spreadsheet conversion. Every heavy library is loaded
 * on demand (dynamic import) so the initial bundle stays small.
 *
 * Two intermediate hubs:
 *  - "doc" formats (txt/md/html/rtf/docx/odt/pptx) round-trip through an HTML
 *    string, parsed into a small {@link Block} model for the binary writers.
 *  - "sheet" formats (csv/xlsx/ods) round-trip through a SheetJS workbook.
 * Cross-family conversions bridge via HTML `<table>` ⇄ workbook.
 */

export interface ConvertResult {
  blob: Blob;
  name: string;
}

type Repr = { kind: "html"; html: string } | { kind: "wb"; wb: WorkBook };

interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
}
interface Block {
  type: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "li" | "pre" | "table";
  runs?: Run[];
  ordered?: boolean;
  rows?: string[][];
}

const MIME: Partial<Record<DocFormat, string>> = {
  txt: "text/plain;charset=utf-8",
  md: "text/markdown;charset=utf-8",
  html: "text/html;charset=utf-8",
  rtf: "application/rtf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv;charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const escapeXml = escapeHtml;

// ---------------------------------------------------------------- HTML ⇄ blocks

function inlineRuns(el: Element): Run[] {
  const runs: Run[] = [];
  const walk = (node: Node, bold: boolean, italic: boolean): void => {
    for (const ch of Array.from(node.childNodes)) {
      if (ch.nodeType === 3) {
        const text = ch.textContent ?? "";
        if (text) runs.push({ text, bold, italic });
      } else if (ch.nodeType === 1) {
        const e = ch as Element;
        const tag = e.tagName.toLowerCase();
        if (tag === "br") runs.push({ text: "\n", bold, italic });
        else
          walk(
            e,
            bold || tag === "b" || tag === "strong",
            italic || tag === "i" || tag === "em",
          );
      }
    }
  };
  walk(el, false, false);
  return runs.length ? runs : [{ text: el.textContent ?? "" }];
}

function tableRows(table: Element): string[][] {
  return Array.from(table.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.querySelectorAll("th,td")).map((td) =>
      (td.textContent ?? "").trim(),
    ),
  );
}

function emit(node: Node, blocks: Block[]): void {
  if (node.nodeType === 3) {
    const text = node.textContent ?? "";
    if (text.trim()) blocks.push({ type: "p", runs: [{ text }] });
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) blocks.push({ type: tag as Block["type"], runs: inlineRuns(el) });
  else if (tag === "p" || tag === "div" || tag === "blockquote")
    blocks.push({ type: "p", runs: inlineRuns(el) });
  else if (tag === "pre") blocks.push({ type: "pre", runs: [{ text: el.textContent ?? "" }] });
  else if (tag === "ul" || tag === "ol") {
    for (const li of Array.from(el.children))
      if (li.tagName.toLowerCase() === "li")
        blocks.push({ type: "li", ordered: tag === "ol", runs: inlineRuns(li) });
  } else if (tag === "table") blocks.push({ type: "table", rows: tableRows(el) });
  else if (tag !== "br") for (const ch of Array.from(el.childNodes)) emit(ch, blocks);
}

function parseBlocks(html: string): Block[] {
  const dom = new DOMParser().parseFromString(html, "text/html");
  const blocks: Block[] = [];
  for (const node of Array.from(dom.body.childNodes)) emit(node, blocks);
  return blocks.length ? blocks : [{ type: "p", runs: [{ text: "" }] }];
}

function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.type === "table") return (b.rows ?? []).map((r) => r.join("\t")).join("\n");
      const txt = (b.runs ?? []).map((r) => r.text).join("");
      return b.type === "li" ? `• ${txt}` : txt;
    })
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textToHtml(text: string): string {
  const esc = escapeHtml(text);
  return esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function wrapHtmlDoc(bodyHtml: string): string {
  return `<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head>\n<body>\n${bodyHtml}\n</body></html>\n`;
}

// ------------------------------------------------------------------------- RTF

function textToRtf(text: string): string {
  const esc = text
    .replace(/[\\{}]/g, (c) => `\\${c}`)
    .replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0)}?`);
  const body = esc.split(/\n/).join("\\par\n");
  return `{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fnil Calibri;}}\\f0\\fs22 ${body}}`;
}

function rtfToText(rtf: string): string {
  let s = rtf;
  // Drop binary/header destinations that would otherwise leak control junk.
  s = s.replace(/\{\\\*?\\(fonttbl|colortbl|stylesheet|info|generator|datastore)[^}]*\}/gi, "");
  s = s.replace(/\\par[d]?\b/g, "\n").replace(/\\line\b/g, "\n").replace(/\\tab\b/g, "\t");
  s = s.replace(/\\'([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(((+n % 65536) + 65536) % 65536));
  s = s.replace(/\\[a-zA-Z]+-?\d* ?/g, ""); // remaining control words
  s = s.replace(/[{}]/g, "");
  return s.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

// ------------------------------------------------------------- binary writers

async function blocksToDocx(blocks: Block[]): Promise<Blob> {
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = docx;
  const HEADINGS = {
    h1: HeadingLevel.HEADING_1,
    h2: HeadingLevel.HEADING_2,
    h3: HeadingLevel.HEADING_3,
    h4: HeadingLevel.HEADING_4,
    h5: HeadingLevel.HEADING_5,
    h6: HeadingLevel.HEADING_6,
  } as const;
  const para = (b: Block) =>
    new Paragraph({
      heading: HEADINGS[b.type as keyof typeof HEADINGS],
      bullet: b.type === "li" ? { level: 0 } : undefined,
      children: (b.runs ?? []).map(
        (r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic }),
      ),
    });
  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [];
  for (const b of blocks) {
    if (b.type === "table") {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: (b.rows ?? []).map(
            (row) =>
              new TableRow({
                children: row.map(
                  (c) => new TableCell({ children: [new Paragraph(c)] }),
                ),
              }),
          ),
        }),
      );
    } else {
      children.push(para(b));
    }
  }
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

async function blocksToOdt(blocks: Block[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const body = blocks
    .map((b) => {
      const text = (b.runs ?? []).map((r) => escapeXml(r.text)).join("");
      if (/^h[1-6]$/.test(b.type))
        return `<text:h text:outline-level="${b.type[1]}">${text}</text:h>`;
      if (b.type === "li")
        return `<text:list><text:list-item><text:p>${text}</text:p></text:list-item></text:list>`;
      if (b.type === "table")
        return (b.rows ?? [])
          .map((r) => `<text:p>${r.map(escapeXml).join(" – ")}</text:p>`)
          .join("");
      return `<text:p>${text}</text:p>`;
    })
    .join("");
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text>${body}</office:text></office:body></office:document-content>`;
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>\n<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`;
  const zip = new JSZip();
  zip.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });
  zip.file("content.xml", content);
  zip.file("META-INF/manifest.xml", manifest);
  return zip.generateAsync({ type: "blob", mimeType: MIME.odt });
}

// Heading sizes (pt) for blocksToPdf — h1 largest, matches the visual weight
// blocksToDocx gets for free from Word's built-in heading styles.
const PDF_HEADING_SIZE: Partial<Record<Block["type"], number>> = {
  h1: 24,
  h2: 20,
  h3: 17,
  h4: 15,
  h5: 13,
  h6: 12,
};

async function blocksToPdf(blocks: Block[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const ensureRoom = (needed: number): void => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  for (const b of blocks) {
    if (b.type === "table") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const row of b.rows ?? []) {
        const lines: string[] = doc.splitTextToSize(row.join("   |   "), maxWidth);
        ensureRoom(lines.length * 12);
        doc.text(lines, margin, y + 9);
        y += lines.length * 12;
      }
      y += 10;
      continue;
    }

    const heading = /^h[1-6]$/.test(b.type);
    const size = PDF_HEADING_SIZE[b.type] ?? 11;
    doc.setFont("helvetica", heading ? "bold" : "normal");
    doc.setFontSize(size);
    const lineHeight = size * 1.3;
    const prefix = b.type === "li" ? "•  " : "";
    const text = prefix + (b.runs ?? []).map((r) => r.text).join("");
    const lines: string[] = doc.splitTextToSize(text || " ", maxWidth);
    ensureRoom(lines.length * lineHeight);
    doc.text(lines, margin, y + size);
    y += lines.length * lineHeight + (heading ? 6 : 4);
  }

  return doc.output("blob");
}

// -------------------------------------------------------------- binary readers

async function docxToHtml(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
  return value;
}

async function odtToHtml(buf: ArrayBuffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("content.xml")?.async("string");
  if (!xml) return "";
  const dom = new DOMParser().parseFromString(xml, "application/xml");
  const out: string[] = [];
  const walk = (node: Element): void => {
    for (const ch of Array.from(node.children)) {
      const tag = ch.tagName;
      if (tag === "text:h") {
        const lvl = Math.min(6, Math.max(1, +(ch.getAttribute("text:outline-level") ?? "2") || 2));
        out.push(`<h${lvl}>${escapeHtml(ch.textContent ?? "")}</h${lvl}>`);
      } else if (tag === "text:p") {
        out.push(`<p>${escapeHtml(ch.textContent ?? "")}</p>`);
      } else {
        walk(ch);
      }
    }
  };
  walk(dom.documentElement);
  return out.join("\n");
}

async function pptxToHtml(buf: ArrayBuffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const slideNo = (n: string): number => Number(n.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => slideNo(a) - slideNo(b));
  const out: string[] = [];
  let i = 0;
  for (const n of names) {
    i++;
    const xml = (await zip.file(n)?.async("string")) ?? "";
    const dom = new DOMParser().parseFromString(xml, "application/xml");
    out.push(`<h2>Slide ${i}</h2>`);
    for (const t of Array.from(dom.getElementsByTagName("a:t"))) {
      const text = t.textContent ?? "";
      if (text.trim()) out.push(`<p>${escapeHtml(text)}</p>`);
    }
  }
  return out.join("\n");
}

interface PdfLine {
  text: string;
  y: number;
  fontSize: number;
}

/**
 * Best-effort PDF text extraction: no layout/images survive, just running
 * text grouped into paragraphs. pdfjs-dist's text items arrive in reading
 * order with a per-line `hasEOL` flag but no paragraph markers, so paragraph
 * breaks are inferred from vertical gaps between lines — a gap noticeably
 * larger than the line's own font size reads as a blank-line break. Page
 * boundaries always force a break, so text never runs across a page edge.
 */
async function pdfToHtml(buf: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = VENDOR.pdfjsWorker;
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;

  const paragraphs: string[] = [];
  let current: string[] = [];
  let prevY: number | null = null;

  const breakParagraph = (): void => {
    if (current.length) paragraphs.push(current.join(" "));
    current = [];
    prevY = null;
  };

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const lines: PdfLine[] = [];
    let text = "";
    let y = 0;
    let fontSize = 10;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      if (!text) {
        y = item.transform[5];
        fontSize = Math.abs(item.transform[3]) || 10;
      }
      text += item.str;
      if (item.hasEOL) {
        if (text.trim()) lines.push({ text: text.trim(), y, fontSize });
        text = "";
      }
    }
    if (text.trim()) lines.push({ text: text.trim(), y, fontSize });

    for (const line of lines) {
      // PDF y increases upward, so reading down the page it decreases —
      // a shrinking gap is normal line spacing, a large one is a paragraph.
      const gap = prevY === null ? 0 : prevY - line.y;
      if (prevY !== null && gap > line.fontSize * 1.5) breakParagraph();
      current.push(line.text);
      prevY = line.y;
    }
    breakParagraph(); // never let a paragraph span a page break
  }

  return paragraphs.length
    ? paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")
    : "<p></p>";
}

// --------------------------------------------------------------- sheet bridge

async function readSheet(file: File, src: DocFormat): Promise<WorkBook> {
  const XLSX = await import("xlsx");
  if (src === "csv") return XLSX.read(await file.text(), { type: "string" });
  return XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
}

async function toWorkbook(repr: Repr): Promise<WorkBook> {
  const XLSX = await import("xlsx");
  if (repr.kind === "wb") return repr.wb;
  const dom = new DOMParser().parseFromString(repr.html, "text/html");
  const tables = Array.from(dom.querySelectorAll("table"));
  const wb = XLSX.utils.book_new();
  if (tables.length) {
    tables.forEach((t, i) =>
      XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(t), `Sheet${i + 1}`),
    );
  } else {
    const aoa = blocksToText(parseBlocks(repr.html))
      .split(/\n/)
      .map((line) => [line]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Sheet1");
  }
  return wb;
}

async function toHtml(repr: Repr): Promise<string> {
  if (repr.kind === "html") return repr.html;
  const XLSX = await import("xlsx");
  return repr.wb.SheetNames.map((name) =>
    XLSX.utils.sheet_to_html(repr.wb.Sheets[name]),
  ).join("\n");
}

async function writeSheet(wb: WorkBook, dst: DocFormat): Promise<Blob> {
  const XLSX = await import("xlsx");
  if (dst === "csv") {
    const str = XLSX.write(wb, { bookType: "csv", type: "string" }) as string;
    return new Blob([str], { type: MIME.csv });
  }
  const buf = XLSX.write(wb, { bookType: dst as "xlsx" | "ods", type: "array" });
  return new Blob([buf], { type: MIME[dst] });
}

// ------------------------------------------------------------------- read/write

async function readSource(file: File, src: DocFormat): Promise<Repr> {
  switch (src) {
    case "txt":
      return { kind: "html", html: textToHtml(await file.text()) };
    case "md": {
      const { marked } = await import("marked");
      return { kind: "html", html: await marked.parse(await file.text()) };
    }
    case "html":
      return { kind: "html", html: await file.text() };
    case "rtf":
      return { kind: "html", html: textToHtml(rtfToText(await file.text())) };
    case "docx":
      return { kind: "html", html: await docxToHtml(await file.arrayBuffer()) };
    case "odt":
      return { kind: "html", html: await odtToHtml(await file.arrayBuffer()) };
    case "pdf":
      return { kind: "html", html: await pdfToHtml(await file.arrayBuffer()) };
    case "pptx":
      return { kind: "html", html: await pptxToHtml(await file.arrayBuffer()) };
    case "csv":
    case "xlsx":
    case "ods":
      return { kind: "wb", wb: await readSheet(file, src) };
    default:
      throw new Error(`Reading .${src} isn't supported in the browser.`);
  }
}

async function writeDoc(html: string, dst: DocFormat): Promise<Blob> {
  switch (dst) {
    case "txt":
      return new Blob([blocksToText(parseBlocks(html))], { type: MIME.txt });
    case "md": {
      const Turndown = (await import("turndown")).default;
      const md = new Turndown({ headingStyle: "atx", codeBlockStyle: "fenced" }).turndown(html);
      return new Blob([md], { type: MIME.md });
    }
    case "html":
      return new Blob([wrapHtmlDoc(html)], { type: MIME.html });
    case "rtf":
      return new Blob([textToRtf(blocksToText(parseBlocks(html)))], { type: MIME.rtf });
    case "docx":
      return blocksToDocx(parseBlocks(html));
    case "odt":
      return blocksToOdt(parseBlocks(html));
    case "pdf":
      return blocksToPdf(parseBlocks(html));
    default:
      throw new Error(`Writing .${dst} isn't supported in the browser.`);
  }
}

/** Convert one file from `src` to `dst`, fully in the browser. */
export async function convertDocument(
  file: File,
  src: DocFormat,
  dst: DocFormat,
): Promise<ConvertResult> {
  if (!FORMATS[src].canRead)
    throw new Error(`.${src} can't be read in the browser (legacy binary format).`);
  if (!FORMATS[dst].canWrite)
    throw new Error(`.${dst} can't be written in the browser.`);

  const base = file.name.replace(/\.[^.]+$/, "") || "document";
  const repr = await readSource(file, src);
  const blob =
    FORMATS[dst].family === "sheet"
      ? await writeSheet(await toWorkbook(repr), dst)
      : await writeDoc(await toHtml(repr), dst);
  return { blob, name: `${base}.${FORMATS[dst].ext}` };
}
