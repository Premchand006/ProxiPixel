"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes } from "@/lib/app/types";
import { convertDocument } from "@/lib/docs/convert";
import {
  DOC_ACCEPT,
  DOC_EXT_RE,
  FORMATS,
  detectFormat,
  targetsFor,
  type DocFormat,
} from "@/lib/docs/formats";

interface DocItem {
  id: number;
  file: File;
  src: DocFormat | null; // null => unsupported / legacy
  target: DocFormat;
  size: number;
  status: string;
  statusKind: "" | "work" | "err";
  result?: { url: string; name: string; size: number };
}

/** A sensible default target for a freshly-added source. */
function defaultTarget(src: DocFormat): DocFormat {
  const targets = targetsFor(src);
  const prefer = FORMATS[src].family === "sheet" ? "csv" : "md";
  return targets.includes(prefer) ? prefer : (targets[0] ?? src);
}

export function DocumentStudio() {
  const [items, setItems] = useState<DocItem[]>([]);
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
          target: src && readable ? defaultTarget(src) : ("md" as DocFormat),
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
      if (!it.src || !FORMATS[it.src].canRead) return;
      update(it.id, { status: "converting…", statusKind: "work" });
      try {
        const { blob, name } = await convertDocument(it.file, it.src, it.target);
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
    [update],
  );

  const runAll = useCallback(async () => {
    const ready = items.filter((it) => it.src && FORMATS[it.src].canRead && !it.result);
    if (!ready.length) return;
    setBusy(true);
    for (const it of ready) await runOne(it);
    setBusy(false);
  }, [items, runOne]);

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

  const convertible = items.filter((it) => it.src && FORMATS[it.src].canRead);

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
          {["DOCX", "ODT", "RTF", "HTML", "MD", "TXT", "PPTX", "XLSX", "CSV", "ODS"].map(
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

      <div className="bar">
        <h3>
          <span>{items.length}</span> file{items.length === 1 ? "" : "s"} loaded
        </h3>
        <div className="barbtns">
          <button
            type="button"
            className="ghost accent"
            disabled={busy || !convertible.length}
            onClick={() => void runAll()}
          >
            {busy ? "Converting…" : "Convert all"}
          </button>
          <button type="button" className="ghost" disabled={!items.length} onClick={clearAll}>
            Clear
          </button>
        </div>
      </div>

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
              </div>

              <div className="docctl">
                {it.src && FORMATS[it.src].canRead && (
                  <>
                    <span className="arrow">→</span>
                    <select
                      aria-label="Convert to"
                      value={it.target}
                      onChange={(e) =>
                        update(it.id, {
                          target: e.target.value as DocFormat,
                          result: undefined,
                          status: "",
                          statusKind: "",
                        })
                      }
                    >
                      {targetsFor(it.src).map((t) => (
                        <option key={t} value={t}>
                          {FORMATS[t].label}
                          {FORMATS[t].bestEffort ? " (best-effort)" : ""}
                        </option>
                      ))}
                    </select>
                    {it.result ? (
                      <a className="dl" href={it.result.url} download={it.result.name}>
                        Download
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="cmpbtn"
                        disabled={it.statusKind === "work"}
                        onClick={() => void runOne(it)}
                      >
                        Convert
                      </button>
                    )}
                  </>
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
