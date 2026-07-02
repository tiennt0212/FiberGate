import Link from "next/link";
import { Card } from "antd";
import { invoices, nodeInfo } from "@/lib/mock/data";
import { ROUTES } from "@/lib/routes";
import { InvoiceTable } from "@/components/InvoiceTable";
import { MetricCard } from "./MetricCard";
import { CapacityCard } from "./CapacityCard";

export default function DashboardPage() {
  const paid = invoices.filter((i) => i.status === "paid");
  const pending = invoices.filter((i) => i.status === "pending");
  const totalCkb = paid
    .filter((i) => i.asset === "CKB")
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Total received"
          value={`${totalCkb.toLocaleString()} CKB`}
          delta={{ value: "12.4%", positive: true }}
          sub="vs last week"
        />
        <MetricCard
          label="Paid invoices"
          value={String(paid.length)}
          sub={`${pending.length} pending`}
        />
        <MetricCard
          label="Active channels"
          value={String(nodeInfo.active_channels)}
          sub="node online"
        />
      </div>

      {/* Capacity + recent */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <CapacityCard node={nodeInfo} />
        </div>
        <div className="lg:col-span-2">
          <Card
            title="Recent Transactions"
            styles={{
              body: { padding: 0 },
              header: { fontSize: 13.5, fontWeight: 600, minHeight: 44 },
            }}
            extra={
              <Link
                href={ROUTES.TRANSACTIONS}
                className="text-[12.5px] font-medium text-accent hover:text-accent-hover"
              >
                View all →
              </Link>
            }
          >
            <InvoiceTable invoices={invoices.slice(0, 4)} />
          </Card>
        </div>
      </div>
    </div>
  );
}
