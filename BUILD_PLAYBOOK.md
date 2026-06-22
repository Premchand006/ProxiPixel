# BUILD_PLAYBOOK.md — paste these into Claude Code, one phase at a time

Rules of engagement (tell Claude Code once, at the start):
> Read CLAUDE.md and PRODUCT_SPEC.md fully. Work one phase at a time from
> BUILD_PLAYBOOK.md. For each phase: first show a short plan, then implement, then run
> `pnpm typecheck && pnpm lint && pnpm test && pnpm build` and report results. Do not
> start the next phase until I say "next". Keep changes PR-sized.

Use **plan mode** for phases 1, 2, and 4 (the big ones). Review the diff after each phase.

---

## Phase 0 — Scaffold
> Scaffold a Next.js (App Router) + TypeScript app with Tailwind, ESLint, Prettier,
> Vitest, and Playwright, using pnpm. Enable `strict` TypeScript. Add npm scripts:
> `dev, build, start, lint, typecheck (tsc --noEmit), test (vitest run), test:e2e,
> drizzle:generate, drizzle:migrate`. Add a CI-style `verify` script that runs typecheck,
> lint, test, build. Commit. Confirm `pnpm verify` passes on the empty app.

## Phase 1 — Port the media engine (no UI yet)
> Port the processing logic from `reference/legacy-index.html` into `lib/engine/` as pure,
> framework-agnostic TypeScript modules (encode, decode, upscale, optimize, exif, pdf,
> video/args, video/ffmpeg). Keep algorithms identical to the reference. Write Vitest unit
> tests that mirror the reference's checks: BMP header/row-padding/BGR order, Lanczos size +
> constant-image preservation, EXIF GPS/camera/date detection on a synthetic JPEG, and
> ffmpeg arg strings for ~5 representative option sets. No React in this phase. Run verify.

## Phase 2 — UI (wired to the engine, still no backend)
> Build the 4-tab UI (Convert, Upscale, Optimize, Video) as React components in
> `components/`, matching the reference's design (port CSS vars + type scale into Tailwind
> theme tokens). Implement the dropzone (click/drag/paste), the queue with thumbnails and
> metadata badges, per-tool option panels, batch ZIP download, the before/after compare
> slider, and the video preview modal. All processing calls `lib/engine`. Everything must
> work fully signed-out. Add a couple of Playwright smoke tests (convert a small PNG→JPEG;
> queue shows a result). Run verify.

## Phase 3 — Supabase + Auth
> Add Supabase (Auth + Postgres + Storage). Wire `@supabase/ssr` for server/client.
> Implement `/login` with email magic-link and Google OAuth. Create the `profiles` table
> and a trigger to insert a profile row on signup. Add a session-aware header (sign in/out,
> avatar). Protect `/library` and `/presets` with a server-side auth check. Put keys in env
> (see .env.example); never expose the service role key to the client. Run verify.

## Phase 4 — Persistence (history + presets)
> Implement the Drizzle schema in `db/schema.ts` (jobs, presets; shares optional) and the
> RLS policies in `db/policies.sql`. Add server actions in `server/` to (a) insert a `jobs`
> row after a local job completes, (b) CRUD presets. Validate every input with Zod and
> enforce `user_id = auth.uid()`. Build `/library` (history list) and `/presets` (save/load
> into the matching tab). Add tests: inserting a job, RLS denies cross-user reads (two test
> users), preset round-trip. Run verify.

## Phase 5 — Saved outputs + sharing (optional)
> Add a private Supabase Storage bucket. Add "Save to my library" on a result: upload that
> one output, store its path on the `jobs` row. Show saved outputs in `/library` with signed
> URLs. Optionally add `shares` + `/s/[slug]` public view with an expiring signed URL.
> Enforce per-user size/count caps. Tests for upload + signed URL + expiry. Run verify.

## Phase 6 — Hardening
> Add loading/empty/error states everywhere, toast notifications, full keyboard a11y for
> tabs/dropzone/sliders/modals, and graceful messages when a CDN lib or FFmpeg fails to
> load. Add rate limiting on server actions. Configure security headers. Expand Playwright
> coverage for the main flows. Run verify + `pnpm test:e2e`.

## Phase 7 — Deploy
> Prepare for Vercel: ensure no Node-only APIs leak into client/edge; add a `vercel.json`
> only if needed. Document required env vars. (Netlify alternative: add `netlify.toml` with
> the Next plugin.) Then I will connect the repo and set env vars in the dashboard.

---

## After deploy — verification checklist
- [ ] Signed-out: all 4 tools work; Network tab shows no upload during processing.
- [ ] Sign in works (magic-link + OAuth). A profile row is created.
- [ ] Running a job adds one history row; it appears in /library.
- [ ] "Save" uploads exactly one object; signed URL opens it; second user can't read it.
- [ ] Presets save and load into the right tab.
- [ ] Video tab loads FFmpeg and produces an MP4 on the deployed https URL.
- [ ] Lighthouse a11y has no critical issues.
