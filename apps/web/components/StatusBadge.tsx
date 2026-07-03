// Status → Tailwind class map. Colors reference the design tokens injected at
const STATUS_CLASS: Record<string, string> = {
  paid: "bg-[var(--status-paid-bg)] text-[var(--status-paid-text)]",
  success: "bg-[var(--status-paid-bg)] text-[var(--status-paid-text)]",
  active: "bg-[var(--status-active-bg)] text-[var(--status-active-text)]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]",
  expired: "bg-[var(--status-expired-bg)] text-[var(--status-expired-text)]",
  disabled: "bg-[var(--status-disabled-bg)] text-[var(--status-disabled-text)]",
  failed: "bg-[var(--status-failed-bg)] text-[var(--status-failed-text)]",
};

export function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_CLASS[status] ?? STATUS_CLASS.disabled;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium capitalize leading-[1.4] ${colorClass}`}
    >
      {status}
    </span>
  );
}
