"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { decodeFile } from "@/lib/engine/decode";
import { renderPdfPages } from "@/lib/engine/pdf";
import { detectExifJPEG } from "@/lib/engine/exif";
import { avifSupported } from "@/lib/engine/encode";
import { setFFmpegCallbacks } from "@/lib/engine/video/ffmpeg";
import {
  DEFAULT_OPTIONS,
  VIDEO_EXT,
  type ConvertOptions,
  type Mode,
  type Options,
  type OptimizeUIOptions,
  type QueueItem,
  type UpscaleUIOptions,
  type WatermarkUIOptions,
} from "./types";
import type { VideoOptions } from "@/lib/engine/types";
import { isJpeg, isPdf, makeThumb, pngSize } from "./files";
import { videoMeta } from "./video-meta";
import { runJob } from "./process";
import { downloadEach, trigger } from "./download";
import { zipResults } from "./zip";
import { recordJob } from "@/server/jobs";
import type { JobInput } from "@/server/validation";
import { attachSavedOutput, prepareSavedOutput } from "@/server/outputs";
import { uploadOutput } from "./storage";
import { useToast } from "./toast";

interface StudioState {
  mode: Mode;
  options: Options;
  items: QueueItem[];
  running: boolean;
  avifOK: boolean | null;
  videoLog: string;
  videoProgress: number;
  compareItem: QueueItem | null;
  videoItem: QueueItem | null;
}

interface StudioActions {
  setMode: (m: Mode) => void;
  setConvert: (patch: Partial<ConvertOptions>) => void;
  setUp: (patch: Partial<UpscaleUIOptions>) => void;
  setOp: (patch: Partial<OptimizeUIOptions>) => void;
  setWm: (patch: Partial<WatermarkUIOptions>) => void;
  setVid: (patch: Partial<VideoOptions>) => void;
  addFiles: (files: FileList | File[]) => void;
  runAll: () => Promise<void>;
  removeItem: (id: number) => void;
  clearAll: () => void;
  downloadAll: () => Promise<void>;
  downloadZip: () => Promise<void>;
  saveOutput: (item: QueueItem) => Promise<void>;
  openCompare: (item: QueueItem) => void;
  closeCompare: () => void;
  openVideo: (item: QueueItem) => void;
  closeVideo: () => void;
}

type StudioContextValue = StudioState & StudioActions;

const StudioContext = createContext<StudioContextValue | null>(null);

/** Map a finished queue item to the metadata persisted in the jobs table. */
function toJobInput(
  it: QueueItem,
  mode: Mode,
  options: Options,
  res: Awaited<ReturnType<typeof runJob>>,
): JobInput {
  const targetFormat =
    mode === "convert"
      ? options.convert.fmt
      : mode === "upscale"
        ? options.up.fmt
        : mode === "optimize"
          ? options.op.fmt
          : mode === "watermark"
            ? options.wm.fmt
            : options.vid.fmt;
  const toolOptions =
    mode === "convert"
      ? options.convert
      : mode === "upscale"
        ? options.up
        : mode === "optimize"
          ? options.op
          : mode === "watermark"
            ? options.wm
            : options.vid;
  return {
    // The Documents tab is self-contained and never records jobs, so `mode`
    // here is always one of the recordable image/video tools.
    kind: mode as JobInput["kind"],
    sourceName: it.name,
    sourceFormat: it.origType || null,
    sourceSize: it.origSize || null,
    targetFormat,
    options: toolOptions as unknown as Record<string, unknown>,
    outputSize: res.resultBlob?.size ?? null,
    status: "done",
  };
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [mode, setModeState] = useState<Mode>("convert");
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [avifOK, setAvifOK] = useState<boolean | null>(null);
  const [videoLog, setVideoLog] = useState("");
  const [videoProgress, setVideoProgress] = useState(0);
  const [compareItem, setCompareItem] = useState<QueueItem | null>(null);
  const [videoItem, setVideoItem] = useState<QueueItem | null>(null);

  const idRef = useRef(1);
  const nextId = (): number => idRef.current++;

  useEffect(() => {
    let alive = true;
    avifSupported().then((ok) => {
      if (alive) setAvifOK(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const updateItem = useCallback(
    (id: number, patch: Partial<QueueItem>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      );
    },
    [],
  );

  // ---- options ----
  const setConvert = useCallback((patch: Partial<ConvertOptions>) => {
    setOptions((p) => ({ ...p, convert: { ...p.convert, ...patch } }));
  }, []);
  const setUp = useCallback((patch: Partial<UpscaleUIOptions>) => {
    setOptions((p) => ({ ...p, up: { ...p.up, ...patch } }));
  }, []);
  const setOp = useCallback((patch: Partial<OptimizeUIOptions>) => {
    setOptions((p) => ({ ...p, op: { ...p.op, ...patch } }));
  }, []);
  const setWm = useCallback((patch: Partial<WatermarkUIOptions>) => {
    setOptions((p) => ({ ...p, wm: { ...p.wm, ...patch } }));
  }, []);
  const setVid = useCallback((patch: Partial<VideoOptions>) => {
    setOptions((p) => ({ ...p, vid: { ...p.vid, ...patch } }));
  }, []);

  // Switching tools clears stale results (matches the reference). Close any
  // open modal first — it holds a snapshot whose result URL is about to be
  // revoked — and drop the now-stale persistence state for each item.
  const setMode = useCallback((m: Mode) => {
    setCompareItem(null);
    setVideoItem(null);
    setModeState(m);
    setItems((prev) =>
      prev.map((it) => {
        if (it.result) URL.revokeObjectURL(it.result);
        return {
          ...it,
          result: undefined,
          resultBlob: undefined,
          resultSize: 0,
          resultName: undefined,
          resultKind: undefined,
          outW: undefined,
          outH: undefined,
          usedQ: undefined,
          jobId: undefined,
          saved: false,
          saving: false,
          status: "",
          statusKind: "",
        };
      }),
    );
  }, []);

  // ---- adding files ----
  const addFiles = useCallback((list: FileList | File[]) => {
    const files = [...list].filter(
      (f) =>
        f.type.startsWith("image/") ||
        f.type.startsWith("video/") ||
        VIDEO_EXT.test(f.name) ||
        /\.(heic|heif|tif|tiff|pdf)$/i.test(f.name),
    );

    for (const file of files) {
      const isVideo =
        file.type.startsWith("video/") || VIDEO_EXT.test(file.name);

      if (isVideo) {
        const id = nextId();
        const it: QueueItem = {
          id,
          name: file.name,
          kind: "video",
          file,
          w: 0,
          h: 0,
          duration: 0,
          origSize: file.size,
          origType: (file.name.split(".").pop() || "VID").toUpperCase(),
          exif: null,
          status: "reading…",
          statusKind: "work",
        };
        setItems((prev) => [...prev, it]);
        videoMeta(file)
          .then((m) =>
            updateItem(id, {
              w: m.w,
              h: m.h,
              duration: m.duration,
              thumb: m.poster,
              status: "",
              statusKind: "",
            }),
          )
          .catch((err: unknown) =>
            updateItem(id, {
              status: (err as Error).message || "Could not read video",
              statusKind: "err",
            }),
          );
        continue;
      }

      if (isPdf(file)) {
        const phId = nextId();
        const placeholder: QueueItem = {
          id: phId,
          name: file.name,
          kind: "image",
          w: 0,
          h: 0,
          origSize: file.size,
          origType: "PDF",
          exif: null,
          status: "rendering pages…",
          statusKind: "work",
        };
        setItems((prev) => [...prev, placeholder]);
        void (async () => {
          try {
            const pages = await renderPdfPages(file);
            const base = file.name.replace(/\.[^.]+$/, "");
            const pageItems: QueueItem[] = [];
            for (const pg of pages) {
              pageItems.push({
                id: nextId(),
                name: `${base}_p${pg.page}`,
                kind: "image",
                canvas: pg.canvas,
                w: pg.canvas.width,
                h: pg.canvas.height,
                origSize: await pngSize(pg.canvas),
                origType: "PDF",
                exif: null,
                thumb: makeThumb(pg.canvas),
                status: "",
                statusKind: "",
              });
            }
            setItems((prev) =>
              prev.filter((x) => x.id !== phId).concat(pageItems),
            );
          } catch (err: unknown) {
            updateItem(phId, {
              status: (err as Error).message || "Could not read PDF",
              statusKind: "err",
            });
          }
        })();
        continue;
      }

      // still image
      const id = nextId();
      const it: QueueItem = {
        id,
        name: file.name,
        kind: "image",
        w: 0,
        h: 0,
        origSize: file.size,
        origType: (file.name.split(".").pop() || "").toUpperCase(),
        exif: null,
        status: "decoding…",
        statusKind: "work",
      };
      setItems((prev) => [...prev, it]);
      void (async () => {
        if (isJpeg(file)) {
          try {
            updateItem(id, { exif: detectExifJPEG(await file.arrayBuffer()) });
          } catch {
            /* exif inspection is best-effort */
          }
        }
        try {
          const c = await decodeFile(file);
          updateItem(id, {
            canvas: c,
            w: c.width,
            h: c.height,
            thumb: makeThumb(c),
            status: "",
            statusKind: "",
          });
        } catch (err: unknown) {
          updateItem(id, {
            status: (err as Error).message || "Could not read",
            statusKind: "err",
          });
        }
      })();
    }
  }, [updateItem]);

  // ---- running ----
  const finishItem = useCallback(
    (id: number, res: Awaited<ReturnType<typeof runJob>>) => {
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== id) return it;
          if (it.result) URL.revokeObjectURL(it.result);
          const url = res.resultBlob
            ? URL.createObjectURL(res.resultBlob)
            : undefined;
          return {
            ...it,
            ...res,
            result: url,
            resultSize: res.resultBlob?.size ?? 0,
            status: "",
            statusKind: "",
          };
        }),
      );
    },
    [],
  );

  const runAll = useCallback(async () => {
    const ready = items.filter((it) =>
      mode === "video"
        ? it.kind === "video" && it.file
        : it.kind === "image" && it.canvas,
    );
    if (!ready.length) return;
    setRunning(true);
    for (const it of ready) {
      updateItem(it.id, { status: "processing…", statusKind: "work" });
      try {
        if (mode === "video") {
          setVideoLog("");
          setVideoProgress(0);
          setFFmpegCallbacks({
            onLog: (m) =>
              setVideoLog((prev) =>
                (m + "\n" + prev).split("\n").slice(0, 40).join("\n"),
              ),
            onProgress: (p) => {
              setVideoProgress(p);
              updateItem(it.id, {
                status: "encoding " + Math.round(p * 100) + "%",
                statusKind: "work",
              });
            },
          });
          updateItem(it.id, { status: "loading FFmpeg…", statusKind: "work" });
        }
        const res = await runJob(it, mode, options);
        finishItem(it.id, res);
        // Persist job metadata if signed in (no-op + ignored otherwise).
        // Capture the row id so the result can be saved to Storage later.
        void recordJob(toJobInput(it, mode, options, res))
          .then((r) => {
            if (r.recorded && r.id) updateItem(it.id, { jobId: r.id });
          })
          .catch(() => {});
        if (mode === "video") {
          setVideoProgress(1);
          setFFmpegCallbacks({});
        }
      } catch (err: unknown) {
        if (mode === "video") setFFmpegCallbacks({});
        const message = (err as Error).message || "Failed";
        updateItem(it.id, {
          status: message,
          statusKind: "err",
          result: undefined,
          resultBlob: undefined,
        });
        toast(`${it.name}: ${message}`, "error");
      }
    }
    setRunning(false);
  }, [items, mode, options, updateItem, finishItem, toast]);

  // ---- queue management ----
  const removeItem = useCallback((id: number) => {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target?.result) URL.revokeObjectURL(target.result);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      for (const it of prev) if (it.result) URL.revokeObjectURL(it.result);
      return [];
    });
  }, []);

  const downloadAll = useCallback(async () => {
    const done = items
      .filter((it) => it.result && it.resultName)
      .map((it) => ({ url: it.result as string, name: it.resultName as string }));
    await downloadEach(done);
  }, [items]);

  const downloadZip = useCallback(async () => {
    const done = items
      .filter((it) => it.resultBlob && it.resultName)
      .map((it) => ({ name: it.resultName as string, blob: it.resultBlob as Blob }));
    if (!done.length) return;
    const blob = await zipResults(done);
    const url = URL.createObjectURL(blob);
    trigger(url, "proxipixel.zip");
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, [items]);

  // ---- save output to library ----
  const saveOutput = useCallback(
    async (item: QueueItem) => {
      if (!item.jobId || !item.resultBlob) return;
      updateItem(item.id, { saving: true, status: "", statusKind: "" });
      try {
        const prep = await prepareSavedOutput({
          jobId: item.jobId,
          size: item.resultBlob.size,
        });
        if (!prep.ok || !prep.path) {
          const message = prep.error ?? "Save failed";
          updateItem(item.id, { saving: false, status: message, statusKind: "err" });
          toast(message, "error");
          return;
        }
        await uploadOutput(prep.path, item.resultBlob);
        const fin = await attachSavedOutput({ jobId: item.jobId });
        updateItem(item.id, {
          saving: false,
          saved: fin.ok,
          status: fin.ok ? "" : (fin.error ?? "Save failed"),
          statusKind: fin.ok ? "" : "err",
        });
        toast(
          fin.ok ? "Saved to your library." : (fin.error ?? "Save failed"),
          fin.ok ? "success" : "error",
        );
      } catch (err: unknown) {
        const message = (err as Error).message || "Save failed";
        updateItem(item.id, { saving: false, status: message, statusKind: "err" });
        toast(message, "error");
      }
    },
    [updateItem, toast],
  );

  // ---- modals ----
  const openCompare = useCallback((item: QueueItem) => setCompareItem(item), []);
  const closeCompare = useCallback(() => setCompareItem(null), []);
  const openVideo = useCallback((item: QueueItem) => setVideoItem(item), []);
  const closeVideo = useCallback(() => setVideoItem(null), []);

  const value = useMemo<StudioContextValue>(
    () => ({
      mode,
      options,
      items,
      running,
      avifOK,
      videoLog,
      videoProgress,
      compareItem,
      videoItem,
      setMode,
      setConvert,
      setUp,
      setOp,
      setWm,
      setVid,
      addFiles,
      runAll,
      removeItem,
      clearAll,
      downloadAll,
      downloadZip,
      saveOutput,
      openCompare,
      closeCompare,
      openVideo,
      closeVideo,
    }),
    [
      mode,
      options,
      items,
      running,
      avifOK,
      videoLog,
      videoProgress,
      compareItem,
      videoItem,
      setMode,
      setConvert,
      setUp,
      setOp,
      setWm,
      setVid,
      addFiles,
      runAll,
      removeItem,
      clearAll,
      downloadAll,
      downloadZip,
      saveOutput,
      openCompare,
      closeCompare,
      openVideo,
      closeVideo,
    ],
  );

  return (
    <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
  );
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio must be used within a StudioProvider");
  return ctx;
}
