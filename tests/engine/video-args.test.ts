import { describe, expect, it } from "vitest";
import { buildVideoArgs, computeCrf } from "@/lib/engine/video/args";
import type { VideoOptions } from "@/lib/engine/types";

const base: VideoOptions = {
  fmt: "mp4",
  q: 65,
  width: "orig",
  aspect: "keep",
  fps: "orig",
  start: 0,
  end: 0,
  mute: false,
};

describe("computeCrf", () => {
  it("maps the quality slider to CRF (q100->18, q0->34)", () => {
    expect(computeCrf(100)).toBe(18);
    expect(computeCrf(0)).toBe(34);
    expect(computeCrf(65)).toBe(24);
    expect(computeCrf(50)).toBe(26);
    expect(computeCrf(80)).toBe(21);
  });
});

describe("buildVideoArgs", () => {
  it("MP4 defaults: H.264 + AAC, no filters", () => {
    expect(buildVideoArgs("in.mp4", "out.mp4", base)).toEqual([
      "-i", "in.mp4",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      "-c:a", "aac", "-b:a", "128k",
      "out.mp4",
    ]);
  });

  it("WebM scaled + fps + muted: VP9, scale/fps filters, -an", () => {
    const o: VideoOptions = {
      ...base,
      fmt: "webm",
      q: 50,
      width: "1280",
      fps: "30",
      mute: true,
    };
    expect(buildVideoArgs("in.webm", "out.webm", o)).toEqual([
      "-i", "in.webm",
      "-vf", "scale='min(1280,iw)':-2:flags=lanczos,fps=30",
      "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "26", "-row-mt", "1",
      "-an",
      "out.webm",
    ]);
  });

  it("GIF: prepends fps=15, default 640 scale, palettegen/paletteuse", () => {
    const o: VideoOptions = { ...base, fmt: "gif" };
    expect(buildVideoArgs("in.mov", "out.gif", o)).toEqual([
      "-i", "in.mov",
      "-vf",
      "fps=15,scale='min(640,iw)':-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3",
      "-loop", "0",
      "out.gif",
    ]);
  });

  it("MP4 with trim + aspect crop + scale", () => {
    const o: VideoOptions = {
      ...base,
      q: 80,
      width: "1920",
      aspect: "1.7778",
      start: 2,
      end: 7.5,
    };
    expect(buildVideoArgs("in.mp4", "out.mp4", o)).toEqual([
      "-ss", "2",
      "-i", "in.mp4",
      "-t", "5.500",
      "-vf",
      "crop='min(iw,ih*1.7778)':'min(ih,iw/1.7778)',scale='min(1920,iw)':-2:flags=lanczos",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      "-c:a", "aac", "-b:a", "128k",
      "out.mp4",
    ]);
  });

  it("MP4 muted at max quality: crf 18 + -an", () => {
    const o: VideoOptions = { ...base, q: 100, mute: true };
    expect(buildVideoArgs("in.mp4", "out.mp4", o)).toEqual([
      "-i", "in.mp4",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      "-an",
      "out.mp4",
    ]);
  });
});
