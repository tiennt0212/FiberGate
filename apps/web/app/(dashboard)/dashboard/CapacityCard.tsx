import { Alert, Card } from "antd";
import type { NodeInfo } from "@/lib/types";
import { shortHash } from "@/lib/format";

const LOW_INBOUND_THRESHOLD = 10; // CKB — BR / US-004 "Low capacity" warning

function Bar({
  label,
  ckb,
  total,
  color,
}: {
  label: string;
  ckb: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((ckb / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px]">
        <span className="text-text-muted">{label}</span>
        <span className="font-mono font-semibold text-text-primary">
          {ckb.toLocaleString()} CKB
        </span>
      </div>
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-border-subtle">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function CapacityCard({ node }: { node: NodeInfo }) {
  const total = node.inbound_capacity_ckb + node.outbound_capacity_ckb;
  const lowInbound = node.inbound_capacity_ckb < LOW_INBOUND_THRESHOLD;

  return (
    <Card
      title="Channel Capacity"
      styles={{
        body: { padding: "18px 20px" },
        header: { fontSize: 13.5, fontWeight: 600, minHeight: 44 },
      }}
    >
      <div className="mb-4 flex items-center justify-between text-[12px] text-text-muted">
        <span>Node ID</span>
        <span className="font-mono text-text-secondary">
          {shortHash(node.pubkey)}
        </span>
      </div>
      <div className="flex flex-col gap-3.5">
        <Bar
          label="Inbound"
          ckb={node.inbound_capacity_ckb}
          total={total}
          color="var(--capacity-inbound)"
        />
        <Bar
          label="Outbound"
          ckb={node.outbound_capacity_ckb}
          total={total}
          color="var(--capacity-outbound)"
        />
      </div>
      {lowInbound && (
        <Alert
          className="mt-4"
          type="warning"
          showIcon
          message="Low capacity"
          description={`Inbound capacity is below ${LOW_INBOUND_THRESHOLD} CKB — new payments may fail.`}
        />
      )}
      <div className="mt-4 border-t border-border-subtle pt-3 text-[12px] text-text-muted">
        {node.active_channels} active channels
      </div>
    </Card>
  );
}
