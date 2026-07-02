import type { NodeInfo } from "@/lib/types";

// Node status indicator (DESIGN.md → "Node Status Indicator") with pulsing dot.
export function NodeStatusPill({ node }: { node: NodeInfo }) {
  const online = node.status === "online";
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2.5 py-1 text-[12px] font-medium"
      style={{
        background: online ? "#f0fdf4" : "#fef2f2",
        borderColor: online ? "#bbf7d0" : "#fecaca",
        color: online ? "#15803d" : "#991b1b",
      }}
    >
      <span
        className={`h-2 w-2 rounded-full ${online ? "pulse-dot" : ""}`}
        style={{ background: online ? "#16a34a" : "#dc2626" }}
      />
      Node {online ? "online" : "offline"}
    </div>
  );
}
