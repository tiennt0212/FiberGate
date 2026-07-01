// BR-RTE-001: whole-deployment cap of 100 invoices/minute. In-memory fixed window —
// resets on restart, which is acceptable for a single-tenant anti-abuse guard.

const INVOICE_LIMIT_PER_MINUTE = 100;
const WINDOW_MS = 60_000;

const globalForRate = globalThis as unknown as {
  __fibergateInvoiceWindow?: { start: number; count: number };
};

export function allowInvoiceCreation(): boolean {
  const now = Date.now();
  const win = globalForRate.__fibergateInvoiceWindow;
  if (!win || now - win.start >= WINDOW_MS) {
    globalForRate.__fibergateInvoiceWindow = { start: now, count: 1 };
    return true;
  }
  if (win.count >= INVOICE_LIMIT_PER_MINUTE) return false;
  win.count += 1;
  return true;
}
