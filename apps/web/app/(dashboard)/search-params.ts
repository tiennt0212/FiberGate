/** Next.js's Server Component `searchParams` prop repeats a key as string[] — this normalizes to the first value. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Shared by both the Invoices and Delivery Log features' page.tsx (table
// filter) and actions.ts (CSV export) — the on-page filtered view and the
// CSV export must agree on which rows match the same `from`/`to` filter bar
// values, so this parsing lives in exactly one place rather than 4 copies.
// Deliberately plain functions (no browser APIs, no hooks) so they're safe
// to import from Server Components, Server Actions, and client components
// alike.

/** yyyy-mm-dd -> the first instant of that UTC day, or undefined if empty/invalid. */
export function parseDateStart(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** yyyy-mm-dd -> the last instant of that UTC day, or undefined if empty/invalid. */
export function parseDateEnd(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Wraps a CSV field value in quotes, doubling any embedded quotes. */
export function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

// Shared by Invoices and Delivery Log's page.tsx: both list services only
// expose a forward cursor (no "previous page" cursor), so Prev/Next are
// absolute page numbers — walking forward from the first page up to the
// requested one on every request. Simple and correct; at hackathon/
// single-merchant data volumes the extra discarded intermediate pages cost
// nothing that matters. A real offset/count-based scheme would need a
// second COUNT query the underlying list services deliberately avoid.
export async function walkToPage<Row>(
  fetchOnePage: (cursor: string | undefined) => Promise<{ rows: Row[]; nextCursor: string | null }>,
  targetPage: number,
): Promise<{ rows: Row[]; hasNextPage: boolean; resolvedPage: number }> {
  let cursor: string | undefined;
  let rows: Row[] = [];
  let nextCursor: string | null = null;
  let resolvedPage = 0;

  for (let i = 0; i <= targetPage; i += 1) {
    const result = await fetchOnePage(cursor);
    rows = result.rows;
    nextCursor = result.nextCursor;
    resolvedPage = i;
    if (i < targetPage) {
      if (!nextCursor) {
        break; // requested page is beyond available data — clamp to the last real page
      }
      cursor = nextCursor;
    }
  }

  return { rows, hasNextPage: nextCursor !== null, resolvedPage };
}

// Safety caps so a runaway filter (or an unfiltered export on a very large
// table) can't turn one click into an unbounded number of DB round-trips.
export const CSV_MAX_PAGES = 50;
export const CSV_PAGE_SIZE = 200;

// Shared by Invoices and Delivery Log's actions.ts CSV export: walk pages up
// to CSV_MAX_PAGES, mapping each row to a field array, then escape/join into
// CSV text. Both exports previously duplicated this loop verbatim, differing
// only in their row->fields mapping and underlying list call.
export async function exportRowsToCsv<Row>(
  header: string[],
  fetchOnePage: (cursor: string | undefined) => Promise<{ rows: Row[]; nextCursor: string | null }>,
  toRow: (row: Row) => string[],
): Promise<string> {
  const lines: string[][] = [header];
  let cursor: string | undefined;

  for (let page = 0; page < CSV_MAX_PAGES; page += 1) {
    const result = await fetchOnePage(cursor);
    for (const row of result.rows) {
      lines.push(toRow(row));
    }
    if (!result.nextCursor) {
      break;
    }
    cursor = result.nextCursor;
  }

  return lines.map((line) => line.map(csvEscape).join(",")).join("\n");
}

// Browser-only (Blob/URL/anchor-click) but a plain function, not a hook —
// safe to import into any client component; never invoked during SSR.
// Shared by the Invoices and Delivery Log tables' "Export CSV" header
// action, which previously each redeclared this verbatim.
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
