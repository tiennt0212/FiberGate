import { Card } from "@/components/Card/Card";

export function StatCard({
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
    <Card>
      <div className="text-caption font-semibold uppercase tracking-wide text-text-xsubtle">
        {label}
      </div>
      <div className="mt-2.5 text-display font-bold leading-none text-text-primary">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 text-label">
        {delta && (
          <span
            className="font-medium"
            style={{ color: `var(--${delta.positive ? "success" : "danger"})` }}
          >
            {delta.positive ? "↑" : "↓"} {delta.value}
          </span>
        )}
        {sub && <span className="text-text-subtle">{sub}</span>}
      </div>
    </Card>
  );
}
