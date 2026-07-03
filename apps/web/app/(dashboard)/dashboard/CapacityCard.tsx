import { Alert, Card } from "antd";
import type { NodeInfo } from "@/lib/types";
import { shortHash } from "@/lib/format";
import { LOW_INBOUND_THRESHOLD_CKB } from "@/lib/constants";
import { CapacityBar } from "@/components/CapacityBar/CapacityBar";

function toPercent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function CapacityCard({ node }: { node: NodeInfo }) {
  const total = node.inbound_capacity_ckb + node.outbound_capacity_ckb;
  const lowInbound = node.inbound_capacity_ckb < LOW_INBOUND_THRESHOLD_CKB;

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
        <CapacityBar
          label="Inbound"
          value={`${node.inbound_capacity_ckb.toLocaleString()} CKB`}
          percent={toPercent(node.inbound_capacity_ckb, total)}
          direction="inbound"
        />
        <CapacityBar
          label="Outbound"
          value={`${node.outbound_capacity_ckb.toLocaleString()} CKB`}
          percent={toPercent(node.outbound_capacity_ckb, total)}
          direction="outbound"
        />
      </div>
      {lowInbound && (
        <Alert
          className="mt-4"
          type="warning"
          showIcon
          message="Low capacity"
          description={`Inbound capacity is below ${LOW_INBOUND_THRESHOLD_CKB} CKB — new payments may fail.`}
        />
      )}
      <div className="mt-4 border-t border-border-subtle pt-3 text-[12px] text-text-muted">
        {node.active_channels} active channels
      </div>
    </Card>
  );
}
