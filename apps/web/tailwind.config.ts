import type { Config } from "tailwindcss";

// Design tokens mirror .context/design/DESIGN.md — do not hardcode colors elsewhere.
const config: Config = {
  // Antd v5 ships its own CSS reset; disabling Tailwind's preflight avoids
  // double-reset artifacts on <a>/<button> (see antd-exp/collab/ecosystem).
  corePlugins: { preflight: false },
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#f7f7f8",
        surface: "#ffffff",
        border: "#e4e4e7",
        "border-subtle": "#f3f4f6",
        "border-focus": "#f0f0f2",
        "text-primary": "#141414",
        "text-secondary": "#52525b",
        "text-muted": "#71717a",
        "text-subtle": "#a1a1aa",
        "text-xsubtle": "#9898a8",
        accent: "#4f46e5",
        "accent-hover": "#4338ca",
        "accent-light": "#eef2ff",
        success: "#16a34a",
        warning: "#f59e0b",
        danger: "#dc2626",
        purple: "#7c3aed",
        "code-bg": "#0f172a",
        "code-bg-dim": "#1e293b",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        card: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
