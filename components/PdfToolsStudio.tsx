"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatBytes } from "@/lib/app/types";
import { zipResults } from "@/lib/app/zip";
import type { NamedBlob, PageNumberPosition } from "@/lib/engine/pdftools";

// pdf-lib (~700KB) is code-split behind this dynamic import so it never
// loads for the five tabs that don't touch PDFs — same pattern the Documents
// tab uses for mammoth/docx/xlsx (see lib/docs/convert.ts).
const loadPdfTools = () => import("@/lib/engine/pdftools");

type OpId =
  | "merge"
  | "split"
  | "remove"
  | "extract"
  | "organize"
  | "rotate"
  | "crop"
  | "numbers";

interface OpMeta {
  id: OpId;
  label: string;
  blurb: string;
  multiFile: boolean;
  accept: string;
  minFiles: number;
}

const OPS: OpMeta[] = [
  {
    id: "merge",
    label: "Merge PDF",
    blurb: "Combine multiple PDFs into one, in the order listed below.",
    multiFile: true,
    accept: "application/pdf,.pdf",
    minFiles: 2,
  },
  {
    id: "split",
    label: "Split PDF",
    blurb: "Split into separate PDFs by page range, or one PDF per page.",
    multiFile: false,
    accept: "application/pdf,.pdf",
    minFiles: 1,
  },
  {
    id: "remove",
    label: "Remove pages",
    blurb: "Delete the pages you list, keep the rest.",
    multiFile: false,
    accept: "application/pdf,.pdf",
    minFiles: 1,
  },
  {
    id: "extract",
    label: "Extract pages",
    blurb: "Pull out just the pages you list, as a new PDF.",
    multiFile: false,
    accept: "application/pdf,.pdf",
    minFiles: 1,
  },
  {
    id: "organize",
    label: "Organize PDF",
    blurb: "Reorder every page — list the new order, e.g. 3,1,2.",
    multiFile: false,
    accept: "application/pdf,.pdf",
    minFiles: 1,
  },
  {
    id: "rotate",
    label: "Rotate PDF",
    blurb: "Rotate all pages, or just the ones you list, 90/180/270°.",
    multiFile: false,
    accept: "application/pdf,.pdf",
    minFiles: 1,
  },
  {
    id: "crop",
    label: "Crop PDF",
    blurb: "Trim an even margin off every page (or the ones you list).",
    multiFile: false,
    accept: "application/pdf,.pdf",
    minFiles: 1,
  },
  {
    id: "numbers",
    label: "Add page numbers",
    blurb: "Stamp a page number onto every page.",
    multiFile: false,
    accept: "application/pdf,.pdf",
    minFiles: 1,
  },
];

const opMeta = (id: OpId): OpMeta => OPS.find((o) => o.id === id)!;

interface Params {
  pages: string; // remove / extract / organize
  splitGroups: string;
  rotateAngle: 90 | 180 | 270;
  rotatePages: string;
  cropMargin: number;
  cropPages: string;
  numberPosition: PageNumberPosition;
  numberStart: number;
  numberFormat: string;
}

const DEFAULT_PARAMS: Params = {
  pages: "",
  splitGroups: "",
  rotateAngle: 90,
  rotatePages: "",
  cropMargin: 20,
  cropPages: "",
  numberPosition: "bottom-center",
  numberStart: 1,
  numberFormat: "{n} / {total}",
};

interface ResultItem extends NamedBlob {
  url: string;
}

export function PdfToolsStudio() {
  const [op, setOpState] = useState<OpId>("merge");
  const [files, setFiles] = useState<File[]>([]);
  const [pageCountFor, setPageCountFor] = useState<{ file: File; count: number } | null>(
    null,
  );
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ msg: string; kind: "" | "err" }>({
    msg: "",
    kind: "",
  });
  const [results, setResults] = useState<ResultItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const meta = opMeta(op);

  const reset = useCallback(() => {
    setFiles([]);
    setResults((prev) => {
      for (const r of prev) URL.revokeObjectURL(r.url);
      return [];
    });
    setStatus({ msg: "", kind: "" });
  }, []);

  const setOperation = useCallback(
    (next: OpId) => {
      setOpState(next);
      setParams(DEFAULT_PARAMS);
      reset();
    },
    [reset],
  );

  // Best-effort page-count hint for single-file page-range ops. The count is
  // stored against the file it was read from, so a stale count never shows
  // for a different (or no longer eligible) file.
  const countFile = !meta.multiFile && files.length === 1 ? files[0]! : null;
  const pageCount =
    countFile && pageCountFor?.file === countFile ? pageCountFor.count : null;
  useEffect(() => {
    if (!countFile) return;
    let cancelled = false;
    void (async () => {
      try {
        const { getPageCount } = await loadPdfTools();
        const count = await getPageCount(countFile);
        if (!cancelled) setPageCountFor({ file: countFile, count });
      } catch {
        if (!cancelled) setPageCountFor(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countFile]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const picked = [...list];
      if (!picked.length) return;
      setResults((prev) => {
        for (const r of prev) URL.revokeObjectURL(r.url);
        return [];
      });
      setStatus({ msg: "", kind: "" });
      setFiles((prev) => (meta.multiFile ? [...prev, ...picked] : [picked[0]!]));
    },
    [meta.multiFile],
  );

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const canRun = files.length >= meta.minFiles && !busy;

  const run = useCallback(async () => {
    if (!canRun) return;
    setBusy(true);
    setStatus({ msg: "", kind: "" });
    try {
      const named: NamedBlob[] = await (async (): Promise<NamedBlob[]> => {
        const base = (n: string) => n.replace(/\.pdf$/i, "");
        const pdftools = await loadPdfTools();
        switch (op) {
          case "merge":
            return [{ name: "merged.pdf", blob: await pdftools.mergePdfs(files) }];
          case "split":
            return pdftools.splitPdf(files[0]!, params.splitGroups);
          case "remove":
            return [
              {
                name: `${base(files[0]!.name)}_edited.pdf`,
                blob: await pdftools.removePages(files[0]!, params.pages),
              },
            ];
          case "extract":
            return [
              {
                name: `${base(files[0]!.name)}_extracted.pdf`,
                blob: await pdftools.extractPages(files[0]!, params.pages),
              },
            ];
          case "organize":
            return [
              {
                name: `${base(files[0]!.name)}_organized.pdf`,
                blob: await pdftools.organizePages(files[0]!, params.pages),
              },
            ];
          case "rotate":
            return [
              {
                name: `${base(files[0]!.name)}_rotated.pdf`,
                blob: await pdftools.rotatePages(
                  files[0]!,
                  params.rotateAngle,
                  params.rotatePages || undefined,
                ),
              },
            ];
          case "crop":
            return [
              {
                name: `${base(files[0]!.name)}_cropped.pdf`,
                blob: await pdftools.cropPages(files[0]!, params.cropMargin, params.cropPages || undefined),
              },
            ];
          case "numbers":
            return [
              {
                name: `${base(files[0]!.name)}_numbered.pdf`,
                blob: await pdftools.addPageNumbers(files[0]!, {
                  position: params.numberPosition,
                  startAt: params.numberStart,
                  format: params.numberFormat || "{n}",
                }),
              },
            ];
        }
      })();
      setResults(named.map((r) => ({ ...r, url: URL.createObjectURL(r.blob) })));
    } catch (err: unknown) {
      setStatus({ msg: (err as Error).message || "Something went wrong", kind: "err" });
    } finally {
      setBusy(false);
    }
  }, [canRun, op, files, params]);

  const downloadAllZip = useCallback(async () => {
    const blob = await zipResults(results.map((r) => ({ name: r.name, blob: r.blob })));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pdf-tools-results.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const pageHint = useMemo(() => {
    if (meta.multiFile || !files.length) return "";
    if (pageCount === null) return "";
    return `${pageCount} page${pageCount === 1 ? "" : "s"}`;
  }, [meta.multiFile, files.length, pageCount]);

  return (
    <>
      <div className="pdftoolgrid" role="group" aria-label="PDF tool">
        {OPS.map((o) => (
          <button
            key={o.id}
            type="button"
            className="pdftoolcard"
            aria-pressed={op === o.id}
            onClick={() => setOperation(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="hint">{meta.blurb}</p>

      <div
        className="drop"
        role="button"
        tabIndex={0}
        aria-label={`Add ${meta.multiFile ? "files" : "a file"} for ${meta.label}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        <div className="iconrow">
          <i />
          <i />
          <i />
        </div>
        <h2>{files.length ? "Drop to add more" : `Drop files for ${meta.label}, or click to browse`}</h2>
        <input
          ref={inputRef}
          type="file"
          aria-label="Add files"
          multiple={meta.multiFile}
          accept={meta.accept}
          className="hide"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="doclist">
          {files.map((f, i) => (
            <div className="docrow" key={`${f.name}-${i}`}>
              <div className="docmeta">
                <div className="name" title={f.name}>
                  {f.name}
                </div>
                <div className="stats">
                  <b>{formatBytes(f.size)}</b>
                  {i === 0 && pageHint && <> · {pageHint}</>}
                </div>
              </div>
              <div className="docctl">
                <button type="button" className="rm" aria-label="Remove" onClick={() => removeFile(i)}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <OpFields op={op} params={params} setParams={setParams} pageCount={pageCount} />
        <div className="spacer" />
        <button
          className="run"
          aria-label={`Run: ${meta.label}`}
          disabled={!canRun}
          onClick={() => void run()}
        >
          {busy ? "Working…" : meta.label}
        </button>
      </div>
      {status.msg && <div className={`status ${status.kind}`}>{status.msg}</div>}

      {results.length > 0 && (
        <div className="doclist">
          {results.length > 1 && (
            <div className="bar">
              <h3>
                <span>{results.length}</span> files ready
              </h3>
              <div className="barbtns">
                <button type="button" className="ghost accent" onClick={() => void downloadAllZip()}>
                  Download all as ZIP
                </button>
              </div>
            </div>
          )}
          {results.map((r, i) => (
            <div className="docrow" key={i}>
              <div className="docmeta">
                <div className="name" title={r.name}>
                  {r.name}
                </div>
                <div className="stats">
                  <b>{formatBytes(r.blob.size)}</b>
                </div>
              </div>
              <div className="docctl">
                <a className="dl" href={r.url} download={r.name}>
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function OpFields({
  op,
  params,
  setParams,
  pageCount,
}: {
  op: OpId;
  params: Params;
  setParams: React.Dispatch<React.SetStateAction<Params>>;
  pageCount: number | null;
}) {
  const set = (patch: Partial<Params>) => setParams((p) => ({ ...p, ...patch }));
  const rangeHint = pageCount ? `This PDF has ${pageCount} pages, e.g. "1,3,5-7"` : `e.g. "1,3,5-7"`;

  switch (op) {
    case "remove":
    case "extract":
    case "organize":
      return (
        <div className="field">
          <label htmlFor="ptPages">{op === "organize" ? "New page order" : "Pages"}</label>
          <input
            id="ptPages"
            type="text"
            placeholder={rangeHint}
            value={params.pages}
            onChange={(e) => set({ pages: e.target.value })}
          />
        </div>
      );
    case "split":
      return (
        <div className="field">
          <label htmlFor="ptSplit">Page groups (optional)</label>
          <input
            id="ptSplit"
            type="text"
            placeholder='e.g. "1-3;4-6;7" — leave blank for one PDF per page'
            value={params.splitGroups}
            onChange={(e) => set({ splitGroups: e.target.value })}
          />
        </div>
      );
    case "rotate":
      return (
        <>
          <div className="field">
            <label htmlFor="ptAngle">Rotate by</label>
            <select
              id="ptAngle"
              value={params.rotateAngle}
              onChange={(e) => set({ rotateAngle: Number(e.target.value) as 90 | 180 | 270 })}
            >
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ptRotatePages">Pages (optional)</label>
            <input
              id="ptRotatePages"
              type="text"
              placeholder={pageCount ? `all ${pageCount} pages, or e.g. "1,3,5-7"` : `all pages, or e.g. "1,3,5-7"`}
              value={params.rotatePages}
              onChange={(e) => set({ rotatePages: e.target.value })}
            />
          </div>
        </>
      );
    case "crop":
      return (
        <>
          <div className="field">
            <label htmlFor="ptMargin">Margin (points, 72 = 1 inch)</label>
            <input
              id="ptMargin"
              type="number"
              min={0}
              step={1}
              value={params.cropMargin}
              onChange={(e) => set({ cropMargin: +e.target.value || 0 })}
            />
          </div>
          <div className="field">
            <label htmlFor="ptCropPages">Pages (optional)</label>
            <input
              id="ptCropPages"
              type="text"
              placeholder={pageCount ? `all ${pageCount} pages, or e.g. "1,3,5-7"` : `all pages, or e.g. "1,3,5-7"`}
              value={params.cropPages}
              onChange={(e) => set({ cropPages: e.target.value })}
            />
          </div>
        </>
      );
    case "numbers":
      return (
        <>
          <div className="field">
            <label htmlFor="ptPos">Position</label>
            <select
              id="ptPos"
              value={params.numberPosition}
              onChange={(e) => set({ numberPosition: e.target.value as PageNumberPosition })}
            >
              <option value="bottom-center">Bottom center</option>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
              <option value="top-center">Top center</option>
              <option value="top-left">Top left</option>
              <option value="top-right">Top right</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ptStart">Start at</label>
            <input
              id="ptStart"
              type="number"
              min={0}
              value={params.numberStart}
              onChange={(e) => set({ numberStart: +e.target.value || 0 })}
            />
          </div>
          <div className="field">
            <label htmlFor="ptFormat">Format</label>
            <input
              id="ptFormat"
              type="text"
              placeholder="{n} / {total}"
              value={params.numberFormat}
              onChange={(e) => set({ numberFormat: e.target.value })}
            />
          </div>
        </>
      );
    default:
      return null;
  }
}
