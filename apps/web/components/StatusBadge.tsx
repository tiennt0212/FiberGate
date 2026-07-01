// Status pill — colors from DESIGN.md "Status Badges".
const STYLES: Record<string, { bg: string; color: string; label: string }> = {
  paid: { bg: "#dcfce7", color: "#15803d", label: "Paid" },
  active: { bg: "#dcfce7", color: "#15803d", label: "Active" },
  success: { bg: "#dcfce7", color: "#15803d", label: "Success" },
  pending: { bg: "#fef9c3", color: "#854d0e", label: "Pending" },
  expired: { bg: "#f3f4f6", color: "#374151", label: "Expired" },
  disabled: { bg: "#f3f4f6", color: "#71717a", label: "Disabled" },
  failed: { bg: "#fee2e2", color: "#991b1b", label: "Failed" },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STYLES[status] ?? { bg: "#f3f4f6", color: "#374151", label: status };
  return (
    <span
      className="inline-block rounded-full px-2 py-[2px] text-[11.5px] font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {label ?? s.label}
    </span>
  );
}
