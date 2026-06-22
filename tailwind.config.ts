import type { Config } from "tailwindcss";

// Design tokens ported from reference/legacy-index.html. The concrete values
// live as CSS custom properties in app/globals.css (:root); these tokens expose
// them to Tailwind utilities (e.g. `bg-surface`, `text-cyan`, `font-display`).
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        line: "var(--line)",
        "line-soft": "var(--line-soft)",
        text: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        cyan: "var(--cyan)",
        magenta: "var(--magenta)",
        amber: "var(--amber)",
        good: "var(--good)",
        bad: "var(--bad)",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      // Type scale highlights from the reference wordmark / headings.
      fontSize: {
        wordmark: ["clamp(30px, 5vw, 44px)", { lineHeight: "1" }],
        "drop-title": ["clamp(18px, 2.5vw, 22px)", { lineHeight: "1.2" }],
      },
    },
  },
  plugins: [],
};

export default config;
