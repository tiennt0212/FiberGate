const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jul 01, 14:23" style timestamp, matching .context/design/FiberGate.dc.html's table cells. Server local time. */
export function formatDateTime(input: Date | string | null | undefined): string {
  if (!input) {
    return "—";
  }
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const month = MONTHS[date.getMonth()];
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${hours}:${minutes}`;
}

/** Short id display for the full-length UUIDs invoices.id/webhook_deliveries.id actually are. */
export function shortId(id: string | null | undefined): string {
  if (!id) {
    return "—";
  }
  return id.slice(0, 8);
}
