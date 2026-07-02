import type { Asset } from "@/lib/types";

// Display helpers — pure, UI-only formatting.

export function formatAmount(amount: number, asset: Asset): string {
  const n = amount.toLocaleString("en-US", {
    minimumFractionDigits: asset === "RUSD" ? 2 : 0,
    maximumFractionDigits: asset === "RUSD" ? 2 : 4,
  });
  return `${n} ${asset}`;
}

export function shortHash(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
