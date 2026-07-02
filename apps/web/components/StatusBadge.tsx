import { Tag } from "antd";
import type { CSSProperties } from "react";

// Colors reference the status tokens defined in app/globals.css (which mirror
// the "Status Badges" table in .context/design/DESIGN.md) — no hardcoded hex.
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid: { bg: "var(--status-paid-bg)", color: "var(--status-paid-text)" },
  success: { bg: "var(--status-paid-bg)", color: "var(--status-paid-text)" },
  active: { bg: "var(--status-active-bg)", color: "var(--status-active-text)" },
  pending: {
    bg: "var(--status-pending-bg)",
    color: "var(--status-pending-text)",
  },
  expired: {
    bg: "var(--status-expired-bg)",
    color: "var(--status-expired-text)",
  },
  disabled: {
    bg: "var(--status-disabled-bg)",
    color: "var(--status-disabled-text)",
  },
  failed: { bg: "var(--status-failed-bg)", color: "var(--status-failed-text)" },
};

const PILL: CSSProperties = {
  borderRadius: "var(--rad-pill)",
  padding: "2px 8px",
  fontSize: "var(--fs-caption)",
  fontWeight: 500,
  border: "none",
  margin: 0,
  lineHeight: 1.4,
  textTransform: "capitalize",
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.disabled;
  return (
    <Tag style={{ ...PILL, background: s.bg, color: s.color }}>{status}</Tag>
  );
}
