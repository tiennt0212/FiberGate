"use client";

import { Button } from "antd";

// Shared Prev/Next footer for cursor-paginated tables (Invoices, Delivery
// Log), previously copy-pasted verbatim between both tables. Deliberately
// NOT Antd's <Pagination> — the backing list queries only expose a forward
// cursor + hasNextPage (see search-params.ts's walkToPage()), never a total
// count, so there's no "N of M items" / "jump to page N" to render. This
// matches .context/design/FiberGate.dc.html's own hand-rolled ← Prev /
// Next → buttons for this exact pattern (COMPONENTS.dc.html's Table pattern
// also specifies `pagination={false}` on the Antd <Table> itself).
export function TablePagination({
  page,
  hasNextPage,
  onPageChange,
}: {
  page: number;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}) {
  if (page === 0 && !hasNextPage) {
    return null;
  }
  return (
    <div className="flex items-center justify-between border-t border-border-subtle px-5 py-3">
      <Button disabled={page === 0} onClick={() => onPageChange(page - 1)} className="h-auto! rounded-md! px-3! py-1! text-[12.5px]!">
        ← Prev
      </Button>
      <span className="text-[12.5px] text-text-muted">Page {page + 1}</span>
      <Button disabled={!hasNextPage} onClick={() => onPageChange(page + 1)} className="h-auto! rounded-md! px-3! py-1! text-[12.5px]!">
        Next →
      </Button>
    </div>
  );
}
