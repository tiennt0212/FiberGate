import { getAllInvoices, getSettlementRows } from "@/lib/dashboard/queries";
import { toInvoiceDTO } from "@/lib/invoices/serialize";
import {
  TransactionsClient,
  type SettlementDTO,
} from "@/components/transactions/TransactionsClient";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [invoiceRows, settlementRows] = await Promise.all([
    getAllInvoices(200),
    getSettlementRows(100),
  ]);

  const invoices = invoiceRows.map(toInvoiceDTO);
  const settlement: SettlementDTO[] = settlementRows.map((r) => ({
    invoiceId: r.invoiceId,
    event: r.event,
    endpointUrl: r.endpointUrl,
    httpStatus: r.httpStatus,
    deliveryStatus: r.deliveryStatus,
    deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return <TransactionsClient invoices={invoices} settlement={settlement} />;
}
