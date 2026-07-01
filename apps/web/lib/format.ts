// Pure display helpers — safe in both server and client components.

export function formatAmount(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 10);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function truncateMiddle(str: string, head = 10, tail = 8): string {
  if (str.length <= head + tail + 1) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

export function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}
