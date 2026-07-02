export const DESIGN_TOKENS = {
  "--bg": "#f7f7f8",
  "--surface": "#ffffff",
  "--border": "#e4e4e7",
  "--border-subtle": "#f3f4f6",
  "--border-focus": "#f0f0f2",
  "--card-hover-border": "#c9c7e5",

  "--text-primary": "#141414",
  "--text-secondary": "#52525b",
  "--text-muted": "#71717a",
  "--text-subtle": "#a1a1aa",
  "--text-xsubtle": "#9898a8",

  "--accent": "#4f46e5",
  "--accent-hover": "#4338ca",
  "--accent-light": "#eef2ff",
  "--accent-ring": "rgba(79, 70, 229, 0.08)",
  "--text-on-accent": "#ffffff",

  "--success": "#16a34a",
  "--warning": "#f59e0b",
  "--danger": "#dc2626",
  "--danger-soft-bg": "#fff5f5",
  "--danger-soft-border": "#fca5a5",
  "--danger-soft-hover": "#fee2e2",
  "--warning-banner-bg": "#fffbeb",
  "--warning-banner-border": "#fde68a",
  "--warning-banner-icon": "#d97706",
  "--warning-banner-title": "#92400e",
  "--warning-banner-text": "#a16207",
  "--purple": "#7c3aed",
  "--code-bg": "#0f172a",
  "--code-bg-dim": "#1e293b",
  "--code-text": "#e2e8f0",

  "--status-paid-bg": "#dcfce7",
  "--status-paid-text": "#15803d",
  "--status-active-bg": "#dcfce7",
  "--status-active-text": "#15803d",
  "--status-pending-bg": "#fef9c3",
  "--status-pending-text": "#854d0e",
  "--status-expired-bg": "#f3f4f6",
  "--status-expired-text": "#374151",
  "--status-disabled-bg": "#f3f4f6",
  "--status-disabled-text": "#71717a",
  "--status-failed-bg": "#fee2e2",
  "--status-failed-text": "#991b1b",

  "--status-online-bg": "#f0fdf4",
  "--status-online-border": "#bbf7d0",
  "--status-online-text": "#15803d",
  "--status-online-dot": "#16a34a",
  "--status-offline-bg": "#fef2f2",
  "--status-offline-border": "#fecaca",
  "--status-offline-text": "#991b1b",
  "--status-offline-dot": "#dc2626",

  "--row-hover": "#f9f9fb",
  "--table-header-bg": "#f9f9fb",
  "--hover-subtle": "#f4f4f5",
  "--asset-tag-bg": "#f3f4f6",
  "--asset-tag-text": "#374151",
  "--capacity-inbound": "#4f46e5",
  "--capacity-outbound": "#7c3aed",

  "--ff-ui": "var(--font-dm-sans), system-ui, sans-serif",
  "--ff-mono": 'var(--font-jetbrains-mono), "Fira Code", monospace',

  "--fs-display": "27px",
  "--fs-page-title": "15px",
  "--fs-card-title": "13.5px",
  "--fs-step-title": "14px",
  "--fs-body": "13px",
  "--fs-label": "12px",
  "--fs-caption": "11.5px",
  "--fs-col-header": "11.5px",
  "--fs-code-sm": "12px",
  "--fs-code-md": "12.5px",

  "--space-xs": "4px",
  "--space-sm": "8px",
  "--space-md": "12px",
  "--space-lg": "16px",
  "--space-xl": "20px",
  "--space-2xl": "28px",
  "--space-3xl": "48px",

  "--rad-card": "8px",
  "--rad-modal": "12px",
  "--rad-button": "6px",
  "--rad-input": "6px",
  "--rad-badge-rect": "4px",
  "--rad-pill": "9999px",
  "--rad-code": "6px",

  "--sidebar-width": "240px",
  "--header-height": "52px",
  "--content-padding": "28px",
} as const;

export type TokenName = keyof typeof DESIGN_TOKENS;

export const t = (name: TokenName): string => DESIGN_TOKENS[name];

export const px = (name: TokenName): number => parseFloat(DESIGN_TOKENS[name]);

export function tokensToCss(): string {
  const decls = (Object.keys(DESIGN_TOKENS) as TokenName[])
    .map((name) => `${name}:${DESIGN_TOKENS[name]}`)
    .join(";");
  return `:root{color-scheme:light;${decls}}`;
}
