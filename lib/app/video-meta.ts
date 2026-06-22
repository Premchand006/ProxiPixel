import { newCanvas, ctx2d } from "@/lib/engine/canvas";

export interface VideoMeta {
  w: number;
  h: number;
  duration: number;
  poster: string;
}

/**
 * Read a video's dimensions/duration and grab a poster frame, all locally via a
 * hidden <video> element. Ported from the reference's `videoMeta`.
 */
export function videoMeta(file: File): Promise<VideoMeta> {
  return new Promise((res, rej) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    const url = URL.createObjectURL(file);
    let done = false;
    v.onloadeddata = () => {
      const w = v.videoWidth;
      const h = v.videoHeight;
      const duration = v.duration || 0;
      try {
        v.currentTime = Math.min(0.1, duration / 3 || 0);
      } catch {
        /* seeking unsupported; the timeout fallback still grabs a frame */
      }
      const grab = (): void => {
        if (done) return;
        done = true;
        const tw = Math.min(320, w || 320);
        const th = Math.max(1, Math.round((h || 180) * (tw / (w || 320))));
        const c = newCanvas(tw, th);
        try {
          ctx2d(c).drawImage(v, 0, 0, tw, th);
        } catch {
          /* drawing a not-yet-decoded frame can throw; poster may be blank */
        }
        URL.revokeObjectURL(url);
        res({ w, h, duration, poster: c.toDataURL("image/png") });
      };
      v.onseeked = grab;
      setTimeout(grab, 600);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      rej(new Error("Could not read video"));
    };
    v.src = url;
  });
}
