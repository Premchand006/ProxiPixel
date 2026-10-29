"use client";

import { THEMES, THEME_STORAGE_KEY, type Theme } from "@/lib/app/theme";

const LABELS: Record<Theme, string> = {
  system: "Theme: System",
  light: "Theme: Light",
  dark: "Theme: Dark",
};

/**
 * Cycles System -> Light -> Dark. The current theme lives on <html data-theme>
 * (set pre-paint by THEME_INIT_SCRIPT), not in React state, and CSS shows the
 * matching label, so server and client render identical markup and the label
 * never flickers on load.
 */
export function ThemeToggle() {
  function cycle(): void {
    const root = document.documentElement;
    const current = (root.dataset.theme as Theme | undefined) ?? "system";
    const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode etc.): the switch still applies for this page.
    }
    if (next === "system") delete root.dataset.theme;
    else root.dataset.theme = next;
  }

  return (
    <button type="button" className="navlink themetoggle" onClick={cycle}>
      {THEMES.map((t) => (
        <span key={t} className="themeopt" data-opt={t}>
          {LABELS[t]}
        </span>
      ))}
    </button>
  );
}
