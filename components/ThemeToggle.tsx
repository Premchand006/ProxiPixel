"use client";

import { THEME_STORAGE_KEY, type Theme } from "@/lib/app/theme";

/**
 * Sun/moon button that flips between light and dark. The active theme lives on
 * <html data-theme> (set pre-paint by THEME_INIT_SCRIPT) or, before the first
 * toggle, comes from the OS. CSS picks the icon (sun while dark, moon while
 * light), so server and client render identical markup and nothing flickers.
 */
export function ThemeToggle() {
  function toggle(): void {
    const root = document.documentElement;
    const current: Theme =
      (root.dataset.theme as Theme | undefined) ??
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next: Theme = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode etc.): the switch still applies for this page.
    }
  }

  return (
    <button
      type="button"
      className="themetoggle"
      onClick={toggle}
      aria-label="Toggle light and dark theme"
      title="Toggle light and dark theme"
    >
      <svg
        className="themeicon themeicon-sun"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
      </svg>
      <svg
        className="themeicon themeicon-moon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
      </svg>
    </button>
  );
}
