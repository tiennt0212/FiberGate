import type { NodeInfo } from "@/lib/types";

export function NodeStatusPill({ node }: { node: NodeInfo }) {
  const online = node.status === "online";
  const boxClass = online
    ? "bg-[var(--status-online-bg)] border-[var(--status-online-border)] text-[var(--status-online-text)]"
    : "bg-[var(--status-offline-bg)] border-[var(--status-offline-border)] text-[var(--status-offline-text)]";
  const dotClass = online
    ? "bg-[var(--status-online-dot)]"
    : "bg-[var(--status-offline-dot)]";

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-[12px] font-medium ${boxClass}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${dotClass} ${online ? "pulse-dot" : ""}`}
      />
      Node {online ? "online" : "offline"}
    </div>
  );
}
