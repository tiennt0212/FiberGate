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
        "card-hover": "var(--card-hover-border)",
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
      // Type scale → var(--fs-*). Enables `text-display`, `text-caption`, …
      // so typography sizes are tokens too, not hardcoded px.
      fontSize: {
        display: "var(--fs-display)",
        "page-title": "var(--fs-page-title)",
        "card-title": "var(--fs-card-title)",
        "step-title": "var(--fs-step-title)",
        body: "var(--fs-body)",
        label: "var(--fs-label)",
        caption: "var(--fs-caption)",
        "col-header": "var(--fs-col-header)",
        "code-sm": "var(--fs-code-sm)",
        "code-md": "var(--fs-code-md)",
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
