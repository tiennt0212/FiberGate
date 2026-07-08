import type { InvoiceRow } from "@/lib/db/schema";
import { listInvoices, type ListInvoicesFilters } from "@/lib/services/invoices";

import { toInvoiceView } from "../invoice-view";
import { firstParam, parseDateEnd, parseDateStart, walkToPage } from "../search-params";

import { isInvoiceAsset, isInvoiceStatus, parseAmountShannon } from "./filters";
import { InvoicesTable } from "./invoices-table";

const PAGE_SIZE = 10;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const statusParam = firstParam(searchParams.status);
  const assetParam = firstParam(searchParams.asset);
  const q = firstParam(searchParams.q) ?? "";
  const from = firstParam(searchParams.from) ?? "";
  const to = firstParam(searchParams.to) ?? "";
  const min = firstParam(searchParams.min) ?? "";
  const max = firstParam(searchParams.max) ?? "";
  const page = Math.max(0, Number(firstParam(searchParams.page)) || 0);

  const filters: ListInvoicesFilters = {
    limit: PAGE_SIZE,
    status: isInvoiceStatus(statusParam) ? statusParam : undefined,
    asset: isInvoiceAsset(assetParam) ? assetParam : undefined,
    search: q || undefined,
    createdFrom: parseDateStart(from),
    createdTo: parseDateEnd(to),
    amountMinShannon: parseAmountShannon(min),
    amountMaxShannon: parseAmountShannon(max),
  };

  let rows: InvoiceRow[] = [];
  let hasNextPage = false;
  let resolvedPage = 0;
  let error: string | null = null;
  try {
    ({ rows, hasNextPage, resolvedPage } = await walkToPage<InvoiceRow>(
      (cursor) => listInvoices({ ...filters, cursor }),
      page,
    ));
  } catch (fetchError) {
    console.error("Invoices: listInvoices failed:", fetchError);
    error = "Could not load invoices. Check the filters and try again.";
  }

  return (
    <InvoicesTable
      rows={rows.map(toInvoiceView)}
      page={resolvedPage}
      hasNextPage={hasNextPage}
      filters={{ status: statusParam ?? "all", asset: assetParam ?? "all", q, from, to, min, max }}
      error={error}
    />
  );
}
