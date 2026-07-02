import Link from "next/link";
import { invoices, nodeInfo } from "@/lib/mock/data";
import { ROUTES } from "@/lib/routes";
import { Card } from "@/components/Card/Card";
import { InvoiceTable } from "@/components/InvoiceTable";
import { StatCard } from "@/components/Card/StatCard";
import { CapacityCard } from "./CapacityCard";

export default function DashboardPage() {
  const paid = invoices.filter((i) => i.status === "paid");
  const pending = invoices.filter((i) => i.status === "pending");
  const totalCkb = paid
    .filter((i) => i.asset === "CKB")
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Volume (30d)"
          value={`${totalCkb.toLocaleString()} CKB`}
          delta={{ value: "12.4%", positive: true }}
          sub="vs last week"
        />

        <StatCard
          label="Total Volume (30d)"
          value={`${totalCkb.toLocaleString()} CKB`}
          delta={{ value: "12.4%", positive: true }}
          sub="vs last week"
        />
        
        <StatCard
          label="Active Channels"
          value={`${totalCkb.toLocaleString()} CKB`}
          delta={{ value: "12.4%", positive: true }}
          sub="vs last week"
        />
        <StatCard
          label="Success Rate"
          value={`${totalCkb.toLocaleString()} CKB`}
          delta={{ value: "12.4%", positive: true }}
          sub="vs last week"
        />
      </div>

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
