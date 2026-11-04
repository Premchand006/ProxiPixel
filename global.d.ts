// Allow side-effect and module imports of stylesheets under `tsc --noEmit`.
// Next's bundler handles these at build time; this keeps the typechecker happy.
declare module "*.css";

// `utif` and `gifenc` ship no types of their own; the real shape ProxiPixel
// uses is already declared in lib/engine/external.ts (UtifModule/
// GifencModule) and cast at the call site, so these just need to exist.
declare module "utif";
declare module "gifenc";
