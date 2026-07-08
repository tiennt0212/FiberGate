import { Tag } from "antd";

// Shared Antd <Tag> wrappers matching .context/design/COMPONENTS.dc.html
// patterns 02 (Status Badge) and 03 (Asset Tag) — every table across
// Overview/Invoices/Delivery Log/Webhooks renders status/asset the same way,
// so the override classes live here once instead of being copy-pasted per
// page (frontend-exp's ui-design-system-hierarchy: use the design system,
// don't hand-roll a <span>).

const STATUS_CLASSNAMES: Record<string, string> = {
  paid: "bg-status-success-bg! text-status-success-text!",
  pending: "bg-status-warning-bg! text-status-warning-text!",
  expired: "bg-border-subtle! text-text-strong!",
  failed: "bg-status-danger-bg! text-status-danger-text!",
  active: "bg-status-success-bg! text-status-success-text!",
  disabled: "bg-border-subtle! text-text-muted!",
  success: "bg-status-success-bg! text-status-success-text!",
  retrying: "bg-status-warning-bg! text-status-warning-text!",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  pending: "Pending",
  expired: "Expired",
  failed: "Failed",
  active: "Active",
  disabled: "Disabled",
  success: "Delivered",
  retrying: "Retrying",
};

export function StatusTag({ status }: { status: string }) {
  const className = STATUS_CLASSNAMES[status] ?? "bg-border-subtle! text-text-strong!";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <Tag className={`rounded-full! border-0! px-2! py-0! text-[11.5px]! font-medium! ${className}`}>{label}</Tag>
  );
}

export function AssetTag({ asset }: { asset: string }) {
  return (
    <Tag className="rounded! border-0! bg-border-subtle! px-2! py-0! font-mono text-[11.5px]! font-semibold! text-text-strong!">
      {asset}
    </Tag>
  );
}

// Single source of truth for webhook_deliveries.status ("pending" | "success"
// | "failed", per WebhookDeliveryStatus in lib/webhooks/deliver.ts) -> color,
// consolidating what used to be 3 independently hand-maintained color maps
// (this file's StatusTag colors above are for a different set of statuses;
// delivery-log-table.tsx's httpCellClassName/httpCellText and
// webhooks-panel.tsx's delivery-history status dot each re-declared their
// own hex values and had already drifted on the "pending" amber shade).
// `text` and `dot` are deliberately different shades for the same status —
// text needs AA contrast against a white background, a dot indicator
// doesn't — but now both roles live in exactly one place per status, so a
// future status (e.g. "skipped") only needs updating here.
export interface DeliveryStatusColor {
  text: string;
  dot: string;
}

const DELIVERY_STATUS_COLORS: Record<string, DeliveryStatusColor> = {
  success: { text: "var(--color-status-success-text)", dot: "var(--color-success)" },
  pending: { text: "var(--color-delivery-pending-text)", dot: "var(--color-warning)" },
  failed: { text: "var(--color-status-danger-text)", dot: "var(--color-danger)" },
};

const DEFAULT_DELIVERY_STATUS_COLOR: DeliveryStatusColor = {
  text: "var(--color-text-muted)",
  dot: "var(--color-text-subtle)",
};

export function deliveryStatusColor(status: string): DeliveryStatusColor {
  return DELIVERY_STATUS_COLORS[status] ?? DEFAULT_DELIVERY_STATUS_COLOR;
}

// Shared "HTTP status or pending→'Retrying…'" cell text, previously
// reimplemented independently in delivery-log-table.tsx, receipt-drawer.tsx,
// and webhooks-panel.tsx. `fallback` keeps each call site's existing
// no-status/non-pending text (delivery-log-table.tsx used "Timeout", the
// other two used "—") instead of silently changing their behavior.
export function deliveryHttpText(delivery: { httpStatus: number | null; status: string }, fallback = "—"): string {
  if (delivery.httpStatus !== null) return String(delivery.httpStatus);
  return delivery.status === "pending" ? "Retrying…" : fallback;
}
