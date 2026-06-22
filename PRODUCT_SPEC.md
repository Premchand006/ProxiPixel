# ProxiPixel — Product Spec

## Summary
A privacy-first media toolkit that runs processing in the browser, with a thin backend
for accounts, history, presets, and shareable results. Deployed on Vercel (Netlify also
supported). Reference implementation: `reference/legacy-index.html` (faithfully port it).

## Users & value
- Anyone who needs to convert/compress/upscale images or convert/trim/crop video.
- Value: fast, free, private (files never leave the device unless the user explicitly
  saves a result), no install.

## Core features (client-side engine — already working in the reference)
1. **Convert** images between PNG, JPEG, WebP, AVIF, BMP, GIF, TIFF, PDF (and PDF→image).
2. **Upscale / clarity**: scale presets + custom width; Lanczos or smooth resampling;
   denoise, clarity (local contrast), sharpen amount + radius.
3. **Optimize**: target a quality OR a target file size (binary-search quality); optional
   width cap; AVIF/WebP/JPEG output; shows % saved.
4. **Video**: convert to MP4 (H.264) / WebM (VP9) / GIF; control quality (CRF), resolution,
   aspect/crop (16:9, 9:16, 1:1, 4:5, 4:3), fps, trim in/out, mute. Runs via FFmpeg.wasm.
5. **EXIF/metadata stripping**: re-encoding drops metadata; surface GPS/camera/date badges.
6. **Batch**: queue, ZIP download, before/after compare slider, video preview.

## Backend features (the new part)
- **Auth**: email magic-link + at least one OAuth (Google or GitHub) via Supabase Auth.
- **Job history**: after a job runs locally, persist metadata (kind, source name/format/
  size, target format, options, output size, status, timestamp). No raw media in the DB.
- **Saved outputs (optional)**: user can click "Save to my library" → upload that one
  output to Supabase Storage (private bucket); DB stores the path + metadata.
- **Presets**: save named tool settings per user; load them into the relevant tab.
- **Shareable links (optional)**: generate a slug for a saved output; signed, expiring URL.
- **Account page**: list history, presets, saved outputs; delete items; sign out.

## Pages / routes
- `/` — the tool (4 tabs). Works fully when signed out (processing is local). Signed-in
  users get "Save" and "Add to history" affordances.
- `/login` — auth.
- `/library` — saved outputs + history (auth required).
- `/presets` — manage presets (auth required).
- `/s/[slug]` — public share view of a saved output (optional).

## Data model (see db/schema.ts)
- `profiles(id→auth.users, display_name, plan, created_at)`
- `jobs(id, user_id, kind, source_name, source_format, source_size, target_format,
   options jsonb, output_size, output_path?, status, created_at)`
- `presets(id, user_id, tool, name, settings jsonb, created_at)`
- `shares(id, job_id, slug unique, expires_at, created_at)` (optional)
RLS: a user can only read/write rows where `user_id = auth.uid()`. Shares are readable by
slug if not expired.

## Non-goals (do NOT build)
- Watermark / SynthID removal of any kind.
- Server-side media transcoding.
- Storing raw user media in Postgres.

## Acceptance criteria (per feature, write tests against these)
- Engine functions are pure, typed, and unit-tested; outputs match the reference for the
  same inputs (e.g. BMP header bytes, Lanczos size/constancy, EXIF GPS detection,
  ffmpeg arg strings for representative option sets).
- Signed-out: all four tools fully work locally; no network calls for processing.
- Signed-in: running a job inserts one `jobs` row; "Save" uploads exactly one object and
  inserts a matching `output_path`. RLS blocks cross-user reads (test with two users).
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass.
- Lighthouse: no critical a11y violations; keyboard works for tabs, dropzone, sliders.

## Performance / limits
- Cap upscale output dimension (e.g. 8000px) and fall back from Lanczos to smooth above
  ~24MP to avoid freezing (already in the reference).
- Warn on very large/long videos (browser memory bound). Suggest size limits for "Save".

## Design
- Dark "image lab" theme; chromatic-split wordmark; mono font for numeric metadata.
  Port the CSS variables and type scale from the reference file into Tailwind tokens.
