import type { VideoOptions } from "../types";

/**
 * Map the 0..100 quality slider to an x264/VP9 CRF.
 * q100 -> 18 (high quality), q0 -> 34 (small file). Ported verbatim.
 */
export function computeCrf(q: number): number {
  return Math.round(34 - (q / 100) * (34 - 18));
}

/**
 * Build the FFmpeg argument vector for a video job. Pure and deterministic so
 * it can be asserted byte-for-byte against the reference's `buildVideoArgs`.
 *
 * Order: `[-ss start?] -i in [-t dur?] [-vf …?] <codec opts> out`.
 */
export function buildVideoArgs(
  inName: string,
  outName: string,
  o: VideoOptions,
): string[] {
  const pre: string[] = [];
  const post: string[] = [];
  if (o.start > 0) pre.push("-ss", String(o.start));
  post.push("-i", inName);
  if (o.end > o.start) post.push("-t", (o.end - o.start).toFixed(3));

  const vf: string[] = [];
  if (o.aspect !== "keep") {
    const ar = o.aspect;
    vf.push(`crop='min(iw,ih*${ar})':'min(ih,iw/${ar})'`);
  }
  if (o.width !== "orig") {
    vf.push(`scale='min(${o.width},iw)':-2:flags=lanczos`);
  }
  if (o.fps !== "orig") {
    vf.push(`fps=${o.fps}`);
  }

  const args: string[] = [...pre, ...post];

  if (o.fmt === "gif") {
    const gvf = [...vf];
    if (o.fps === "orig") gvf.unshift("fps=15");
    if (o.width === "orig") gvf.push("scale='min(640,iw)':-1:flags=lanczos");
    gvf.push(
      "split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
    );
    args.push("-vf", gvf.join(","), "-loop", "0", outName);
    return args;
  }

  if (vf.length) args.push("-vf", vf.join(","));

  const crf = computeCrf(o.q);
  if (o.fmt === "webm") {
    args.push("-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(crf), "-row-mt", "1");
    if (o.mute) args.push("-an");
    else args.push("-c:a", "libopus", "-b:a", "128k");
  } else {
    // mp4 / h264
    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      String(crf),
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
    );
    if (o.mute) args.push("-an");
    else args.push("-c:a", "aac", "-b:a", "128k");
  }

  args.push(outName);
  return args;
}
