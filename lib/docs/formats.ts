/**
 * Document & spreadsheet format registry for the Documents tab. All conversion
 * runs 100% locally in the browser (see `convert.ts`). Two families share an
 * intermediate hub: "doc" formats round-trip through HTML, "sheet" formats
 * through a SheetJS workbook, and the engine bridges between them.
 */

export type DocFormat =
  | "txt"
  | "md"
  | "html"
  | "rtf"
  | "docx"
  | "odt"
  | "pptx"
  | "ppt"
  | "csv"
  | "xlsx"
  | "ods";

export interface FormatInfo {
  ext: string;
  label: string;
  family: "doc" | "sheet";
  canRead: boolean;
  canWrite: boolean;
  /** Full fidelity vs. best-effort (text/structure only). */
  bestEffort?: boolean;
}

export const FORMATS: Record<DocFormat, FormatInfo> = {
  txt: { ext: "txt", label: "Text", family: "doc", canRead: true, canWrite: true },
  md: { ext: "md", label: "Markdown", family: "doc", canRead: true, canWrite: true },
  html: { ext: "html", label: "HTML", family: "doc", canRead: true, canWrite: true },
  rtf: { ext: "rtf", label: "Rich Text (RTF)", family: "doc", canRead: true, canWrite: true },
  docx: { ext: "docx", label: "Word (DOCX)", family: "doc", canRead: true, canWrite: true },
  odt: {
    ext: "odt",
    label: "OpenDocument Text (ODT)",
    family: "doc",
    canRead: true,
    canWrite: true,
    bestEffort: true,
  },
  // PPTX import extracts slide text; export (generating a presentation from
  // prose) is intentionally not offered — it needs a heavy, node-coupled
  // library and produces low-value output.
  pptx: {
    ext: "pptx",
    label: "PowerPoint (PPTX)",
    family: "doc",
    canRead: true,
    canWrite: false,
    bestEffort: true,
  },
  // Legacy binary PowerPoint — not convertible client-side.
  ppt: { ext: "ppt", label: "PowerPoint 97–2003 (PPT)", family: "doc", canRead: false, canWrite: false },
  csv: { ext: "csv", label: "CSV", family: "sheet", canRead: true, canWrite: true },
  xlsx: { ext: "xlsx", label: "Excel (XLSX)", family: "sheet", canRead: true, canWrite: true },
  ods: { ext: "ods", label: "OpenDocument Sheet (ODS)", family: "sheet", canRead: true, canWrite: true },
};

const BY_EXT: Record<string, DocFormat> = {
  txt: "txt",
  text: "txt",
  md: "md",
  markdown: "md",
  mdown: "md",
  markdn: "md",
  html: "html",
  htm: "html",
  xhtml: "html",
  rtf: "rtf",
  docx: "docx",
  odt: "odt",
  pptx: "pptx",
  ppt: "ppt",
  csv: "csv",
  tsv: "csv",
  xlsx: "xlsx",
  xlsm: "xlsx",
  xls: "xlsx",
  ods: "ods",
};

/** All extensions the Documents dropzone accepts (for the file input). */
export const DOC_ACCEPT = Object.keys(BY_EXT)
  .map((e) => `.${e}`)
  .join(",");

/** Regex that matches any supported document/spreadsheet file name. */
export const DOC_EXT_RE = new RegExp(
  `\\.(${Object.keys(BY_EXT).join("|")})$`,
  "i",
);

/** Detect the source format from a file name; null if unsupported. */
export function detectFormat(name: string): DocFormat | null {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return BY_EXT[ext] ?? null;
}

/** Writable formats a given source can target (cross-family allowed). */
export function targetsFor(src: DocFormat): DocFormat[] {
  return (Object.keys(FORMATS) as DocFormat[]).filter(
    (f) => FORMATS[f].canWrite && f !== src,
  );
}
