const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Shared by every formatter below: coerce to Date, or null for a missing/invalid input. */
function parseDate(input: Date | string | null | undefined): Date | null {
  if (!input) {
    return null;
  }
  const date = typeof input === "string" ? new Date(input) : input;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Jul 01, 14:23" style timestamp, matching .context/design/FiberGate.dc.html's table cells. Server local time. */
export function formatDateTime(input: Date | string | null | undefined): string {
  const date = parseDate(input);
  if (!date) {
    return "—";
  }
  const month = MONTHS[date.getMonth()];
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${hours}:${minutes}`;
}

/** "14:23:05" fixed-format timestamp with seconds, not locale-dependent — used by the Activity feed. */
export function formatTimeWithSeconds(input: Date | string | null | undefined): string {
  const date = parseDate(input);
  if (!date) {
    return "—";
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/** Short id display for the full-length UUIDs invoices.id/webhook_deliveries.id actually are. */
export function shortId(id: string | null | undefined): string {
  if (!id) {
    return "—";
  }
  return id.slice(0, 8);
}

/** "4m 12s" / "1h 6m" style duration — Overview's Invoice Funnel "Avg. Time to Payment" card. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || Number.isNaN(totalSeconds)) {
    return "—";
  }
  const seconds = Math.round(totalSeconds);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
