import type { Config } from "tailwindcss";

const config: Config = {
  corePlugins: { preflight: false },
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        "border-focus": "var(--border-focus)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "text-subtle": "var(--text-subtle)",
        "text-xsubtle": "var(--text-xsubtle)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-light": "var(--accent-light)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        purple: "var(--purple)",
        "code-bg": "var(--code-bg)",
        "code-bg-dim": "var(--code-bg-dim)",
        "code-text": "var(--code-text)",
        "row-hover": "var(--row-hover)",
        "asset-tag-bg": "var(--asset-tag-bg)",
        "asset-tag-text": "var(--asset-tag-text)",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        card: "var(--radius-card)",
        button: "var(--radius-button)",
        pill: "var(--radius-pill)",
        code: "var(--radius-code)",
      },
    },
  },
  plugins: [],
};

export default config;
