"use client";

import { useStudio } from "@/lib/app/store";
import { RunButton } from "@/components/RunButton";
import type { VideoOptions } from "@/lib/engine/types";

export function VideoPanel() {
  const { options, setVid, running, videoLog, videoProgress } = useStudio();
  const v = options.vid;

  return (
    <>
      <div className="field">
        <label htmlFor="vFmt">Output</label>
        <select
          id="vFmt"
          value={v.fmt}
          onChange={(e) =>
            setVid({ fmt: e.target.value as VideoOptions["fmt"] })
          }
        >
          <option value="mp4">MP4 (H.264)</option>
          <option value="webm">WebM (VP9)</option>
          <option value="gif">GIF</option>
        </select>
      </div>

      {v.fmt !== "gif" && (
        <div className="field" id="vQwrap">
          <label htmlFor="vQ">Quality</label>
          <div className="rangewrap">
            <input
              type="range"
              id="vQ"
              min={0}
              max={100}
              value={v.q}
              onChange={(e) => setVid({ q: +e.target.value })}
            />
            <span className="rangeval" id="vQv">
              {v.q}
            </span>
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="vWidth">Resolution</label>
        <select
          id="vWidth"
          value={v.width}
          onChange={(e) => setVid({ width: e.target.value })}
        >
          <option value="orig">Original</option>
          <option value="3840">2160p (4K)</option>
          <option value="2560">1440p</option>
          <option value="1920">1080p</option>
          <option value="1280">720p</option>
          <option value="854">480p</option>
          <option value="640">360p</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="vAspect">Aspect / crop</label>
        <select
          id="vAspect"
          value={v.aspect}
          onChange={(e) => setVid({ aspect: e.target.value })}
        >
          <option value="keep">Keep</option>
          <option value="1.7778">16:9</option>
          <option value="0.5625">9:16</option>
          <option value="1">1:1</option>
          <option value="0.8">4:5</option>
          <option value="1.3333">4:3</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="vFps">Frame rate</label>
        <select
          id="vFps"
          value={v.fps}
          onChange={(e) => setVid({ fps: e.target.value })}
        >
          <option value="orig">Original</option>
          <option value="60">60</option>
          <option value="30">30</option>
          <option value="24">24</option>
          <option value="15">15</option>
        </select>
      </div>

      <div className="field">
        <label htmlFor="vStart">Trim start (s)</label>
        <input
          type="number"
          id="vStart"
          min={0}
          step={0.1}
          value={v.start}
          onChange={(e) => setVid({ start: +e.target.value || 0 })}
        />
      </div>

      <div className="field">
        <label htmlFor="vEnd">Trim end (s)</label>
        <input
          type="number"
          id="vEnd"
          min={0}
          step={0.1}
          placeholder="end"
          value={v.end}
          onChange={(e) => setVid({ end: +e.target.value || 0 })}
        />
      </div>

      <div className="field" style={{ justifyContent: "flex-end" }}>
        <label className="check">
          <input
            type="checkbox"
            id="vMute"
            checked={v.mute}
            onChange={(e) => setVid({ mute: e.target.checked })}
          />{" "}
          Remove audio
        </label>
      </div>

      <div className="spacer" />
      <RunButton />

      {(running || videoProgress > 0) && (
        <div className="progress" id="vProg">
          <i
            id="vProgBar"
            style={{ width: `${Math.round(videoProgress * 100)}%` }}
          />
        </div>
      )}
      {videoLog && (
        <div className="vlog" id="vLog">
          {videoLog}
        </div>
      )}
      <div className="warnote">
        Video runs locally via FFmpeg (~31 MB, loads on first run). Serve this
        page over http(s) — it won’t run from a file:// double-click.
      </div>
    </>
  );
}
