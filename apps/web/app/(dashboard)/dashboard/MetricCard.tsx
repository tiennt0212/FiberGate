import { Card } from "antd";

export function MetricCard({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: { value: string; positive: boolean };
}) {
  return (
    <Card styles={{ body: { padding: "18px 20px" } }}>
      <div className="text-[12px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </div>
      <div className="mt-2 text-[27px] font-bold leading-none text-text-primary">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[12px]">
        {delta && (
          <span
            style={{ color: delta.positive ? "#16a34a" : "#dc2626" }}
            className="font-semibold"
          >
            {delta.positive ? "▲" : "▼"} {delta.value}
          </span>
        )}
        {sub && <span className="text-text-subtle">{sub}</span>}
      </div>
    </Card>
  );
}
