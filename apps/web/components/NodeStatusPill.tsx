import type { NodeInfo } from "@/lib/types";

export function NodeStatusPill({ node }: { node: NodeInfo }) {
  const online = node.status === "online";
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-2.5 py-1 text-[12px] font-medium"
      style={{
        background: `var(--status-${online ? "online" : "offline"}-bg)`,
        borderColor: `var(--status-${online ? "online" : "offline"}-border)`,
        color: `var(--status-${online ? "online" : "offline"}-text)`,
      }}
    >
      <span
        className={`h-2 w-2 rounded-full ${online ? "pulse-dot" : ""}`}
        style={{
          background: `var(--status-${online ? "online" : "offline"}-dot)`,
        }}
      />
      Node {online ? "online" : "offline"}
    </div>
  );
}
