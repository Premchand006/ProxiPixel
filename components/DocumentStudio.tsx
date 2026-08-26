"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/app/types";
import { convertDocument } from "@/lib/docs/convert";
import {
  DOC_ACCEPT,
  DOC_EXT_RE,
  FORMATS,
  detectFormat,
  type DocFormat,
} from "@/lib/docs/formats";

interface DocItem {
  id: number;
  file: File;
  src: DocFormat | null; // null => unsupported / legacy
  size: number;
  status: string;
  statusKind: "" | "work" | "err";
  result?: { url: string; name: string; size: number };
}

// Every writable format is a valid target for every readable source — the
// doc/sheet families bridge through HTML tables (see lib/docs/formats.ts) —
// so one global target works uniformly, same as the Pixel tab's "Convert to".
const WRITABLE_FORMATS = (Object.keys(FORMATS) as DocFormat[]).filter(
  (f) => FORMATS[f].canWrite,
);

export function DocumentStudio() {
  const [items, setItems] = useState<DocItem[]>([]);
  const [target, setTarget] = useState<DocFormat>("md");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(1);

  // Revoke result object URLs on unmount.
  useEffect(() => {
    return () => {
      setItems((prev) => {
        for (const it of prev) if (it.result) URL.revokeObjectURL(it.result.url);
        return prev;
      });
    };
  }, []);

  const update = useCallback((id: number, patch: Partial<DocItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const addFiles = useCallback((list: FileList | File[]) => {
    const files = [...list].filter((f) => DOC_EXT_RE.test(f.name));
    if (!files.length) return;
    setItems((prev) => [
      ...prev,
      ...files.map((file): DocItem => {
        const src = detectFormat(file.name);
        const readable = !!src && FORMATS[src].canRead;
        return {
          id: idRef.current++,
          file,
          src,
          size: file.size,
          status: readable
            ? ""
            : src
              ? "Legacy binary format — import not supported"
              : "Unsupported file type",
          statusKind: readable ? "" : "err",
        };
      }),
    ]);
  }, []);

  const runOne = useCallback(
    async (it: DocItem): Promise<void> => {
      if (!it.src || !FORMATS[it.src].canRead || it.src === target) return;
      update(it.id, { status: "converting…", statusKind: "work" });
      try {
        const { blob, name } = await convertDocument(it.file, it.src, target);
        update(it.id, {
          status: "",
          statusKind: "",
          result: { url: URL.createObjectURL(blob), name, size: blob.size },
        });
      } catch (err: unknown) {
        update(it.id, {
          status: (err as Error).message || "Conversion failed",
          statusKind: "err",
        });
      }
    },
    [update, target],
  );

  const runAll = useCallback(async () => {
    const ready = items.filter(
      (it) => it.src && FORMATS[it.src].canRead && it.src !== target && !it.result,
    );
    if (!ready.length) return;
    setBusy(true);
    for (const it of ready) await runOne(it);
    setBusy(false);
  }, [items, target, runOne]);

  const removeItem = useCallback((id: number) => {
    setItems((prev) => {
      const t = prev.find((x) => x.id === id);
      if (t?.result) URL.revokeObjectURL(t.result.url);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      for (const it of prev) if (it.result) URL.revokeObjectURL(it.result.url);
      return [];
    });
  }, []);

  // Clear stale results when the target changes, so a downloaded link never
  // silently disagrees with the currently-selected format.
  const setTargetFormat = useCallback((next: DocFormat) => {
    setTarget(next);
    setItems((prev) => {
      for (const it of prev) if (it.result) URL.revokeObjectURL(it.result.url);
      return prev.map((it) => ({ ...it, result: undefined }));
    });
  }, []);

  const convertible = items.filter(
    (it) => it.src && FORMATS[it.src].canRead && it.src !== target,
  );

  return (
    <>
      <div
        className={`drop${over ? " over" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Add documents: click, drop, or paste"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
        }}
      >
        <div className="iconrow">
          <i />
          <i />
          <i />
        </div>
        <h2>Drop documents &amp; spreadsheets to convert</h2>
        <p>
          Drag &amp; drop or <span className="pick">click to browse</span> — all
          conversion runs locally, nothing is uploaded
        </p>
        <div className="formats">
          {["DOCX", "ODT", "RTF", "PDF", "HTML", "MD", "TXT", "PPTX", "XLSX", "CSV", "ODS"].map(
            (f) => (
              <span className="fmt" key={f}>
                {f}
              </span>
            ),
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          aria-label="Add document files"
          multiple
          accept={DOC_ACCEPT}
          className="hide"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="panel">
        <div className="field">
          <label htmlFor="docFmt">Convert to</label>
          <select
            id="docFmt"
            value={target}
            onChange={(e) => setTargetFormat(e.target.value as DocFormat)}
          >
            {WRITABLE_FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMATS[f].label}
                {FORMATS[f].bestEffort ? " (best-effort)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="spacer" />
        <button
          className="run"
          disabled={busy || !convertible.length}
          onClick={() => void runAll()}
        >
          {busy ? "Working…" : "Convert all"}
        </button>
      </div>

      {items.length > 0 && (
        <div className="bar">
          <h3>
            <span>{items.length}</span> file{items.length === 1 ? "" : "s"} loaded
          </h3>
          <div className="barbtns">
            <button type="button" className="ghost" onClick={clearAll}>
              Clear
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty">No files yet — add some above to get started.</div>
      ) : (
        <div className="doclist">
          {items.map((it) => (
            <div className="docrow" key={it.id}>
              <div className="docmeta">
                <div className="name" title={it.file.name}>
                  {it.file.name}
                </div>
                <div className="stats">
                  <span className="pill">{it.src ? FORMATS[it.src].label : "—"}</span>{" "}
                  · <b>{formatBytes(it.size)}</b>
                  {it.result && (
                    <>
                      {" "}
                      → <b>{formatBytes(it.result.size)}</b>{" "}
                      {it.result.name.split(".").pop()?.toUpperCase()}
                    </>
                  )}
                </div>
                {it.status && <div className={`status ${it.statusKind}`}>{it.status}</div>}
                {!it.status && it.src === target && (
                  <div className="status">Already {FORMATS[target].label}</div>
                )}
              </div>

              <div className="docctl">
                {it.result && (
                  <a className="dl" href={it.result.url} download={it.result.name}>
                    Download
                  </a>
                )}
                <button
                  type="button"
                  className="rm"
                  aria-label="Remove"
                  onClick={() => removeItem(it.id)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
