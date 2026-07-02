import { Tag } from "antd";
import type { CSSProperties } from "react";

// Pill badge for invoice + webhook-delivery statuses.
// Colors mirror the "Status Badges" table in .context/design/DESIGN.md.
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  paid: { bg: "#dcfce7", color: "#15803d" },
  success: { bg: "#dcfce7", color: "#15803d" },
  active: { bg: "#dcfce7", color: "#15803d" },
  pending: { bg: "#fef9c3", color: "#854d0e" },
  expired: { bg: "#f3f4f6", color: "#374151" },
  disabled: { bg: "#f3f4f6", color: "#71717a" },
  failed: { bg: "#fee2e2", color: "#991b1b" },
};

const PILL: CSSProperties = {
  borderRadius: 9999,
  padding: "2px 8px",
  fontSize: 11.5,
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
