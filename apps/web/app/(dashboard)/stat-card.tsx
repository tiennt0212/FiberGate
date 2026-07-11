import type { ReactNode } from "react";

// Shared by Overview's metric cards + Invoice Funnel row and Webhooks'
// Delivery Health row (issue #40 refactor — these were 4 near-identical
// blocks copy-pasted in overview/page.tsx before this). `size="lg"` matches
// FiberGate.dc.html's main 4 metric cards (27px value); `size="md"` matches
// the smaller Invoice Funnel / Delivery Health cards (22px value).
export function StatCard({
  label,
  value,
  sub,
  size = "lg",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  size?: "lg" | "md";
}) {
  return (
    <div className={`rounded-lg border border-border bg-white px-5 ${size === "lg" ? "py-4.5" : "py-4"} hover:border-border-hover`}>
      <div className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-text-xsubtle">{label}</div>
      <div className={`mb-1 ${size === "lg" ? "text-[27px]" : "text-[22px]"} font-bold leading-none text-text-primary`}>{value}</div>
      {sub !== undefined ? <div className="text-[12px] text-text-subtle">{sub}</div> : null}
    </div>
  );
}
