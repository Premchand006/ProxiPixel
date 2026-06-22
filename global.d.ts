// Allow side-effect and module imports of stylesheets under `tsc --noEmit`.
// Next's bundler handles these at build time; this keeps the typechecker happy.
declare module "*.css";
