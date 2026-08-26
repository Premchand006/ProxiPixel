/**
 * Minimal type surfaces for libraries loaded lazily at runtime (dynamic
 * `import()` for npm packages without bundled types, or UMD script injection
 * for FFmpeg.wasm). Only the members ProxiPixel actually calls are typed.
 */

export interface UtifIFD {
  width: number;
  height: number;
}
export interface UtifModule {
  decode(buf: ArrayBuffer): UtifIFD[];
  decodeImage(buf: ArrayBuffer, ifd: UtifIFD): void;
  toRGBA8(ifd: UtifIFD): Uint8Array;
  encodeImage(
    data: Uint8ClampedArray | Uint8Array,
    w: number,
    h: number,
  ): ArrayBuffer;
}

export interface GifEncoderInstance {
  writeFrame(
    index: Uint8Array,
    w: number,
    h: number,
    opts: { palette: number[][] },
  ): void;
  finish(): void;
  bytes(): Uint8Array<ArrayBuffer>;
}
export interface GifencModule {
  GIFEncoder(): GifEncoderInstance;
  quantize(data: Uint8ClampedArray, maxColors: number): number[][];
  applyPalette(data: Uint8ClampedArray, palette: number[][]): Uint8Array;
}

export interface JsPDFInstance {
  addImage(
    data: string,
    fmt: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void;
  output(type: "blob"): Blob;
}
export interface JsPDFConstructor {
  new (opts: {
    orientation: "l" | "p";
    unit: string;
    format: [number, number];
  }): JsPDFInstance;
}

export interface PdfjsViewport {
  width: number;
  height: number;
}
export interface PdfjsPage {
  getViewport(o: { scale: number }): PdfjsViewport;
  render(o: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfjsViewport;
  }): { promise: Promise<void> };
}
export interface PdfjsDoc {
  numPages: number;
  getPage(n: number): Promise<PdfjsPage>;
}
export interface PdfjsModule {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: Uint8Array }): { promise: Promise<PdfjsDoc> };
}

export interface FFmpegInstance {
  on(event: "log", cb: (e: { message: string }) => void): void;
  on(event: "progress", cb: (e: { progress: number }) => void): void;
  load(opts: {
    classWorkerURL: string;
    coreURL: string;
    wasmURL: string;
  }): Promise<boolean>;
  writeFile(name: string, data: Uint8Array): Promise<boolean>;
  readFile(name: string): Promise<Uint8Array<ArrayBuffer>>;
  exec(args: string[]): Promise<number>;
  deleteFile(name: string): Promise<boolean>;
}
export interface FFmpegConstructor {
  new (): FFmpegInstance;
}

declare global {
  interface Window {
    FFmpegWASM?: { FFmpeg: FFmpegConstructor };
  }
}

export {};
