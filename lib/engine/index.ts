/**
 * ProxiPixel media engine — framework-agnostic. Pure algorithms (encodeBMP,
 * lanczosResize, enhance, detectExifJPEG, buildVideoArgs, optimizeToTargetSize)
 * have no DOM dependency; the rest are thin Canvas/CDN browser adapters.
 */
export * from "./types";
export * from "./raster";
export * from "./exif";
export * from "./upscale";
export * from "./watermark";
export * from "./encode";
export * from "./decode";
export * from "./optimize";
export * from "./pdf";
export * from "./canvas";
export * from "./loaders";
export * from "./external";
export * from "./video/args";
export * from "./video/ffmpeg";
