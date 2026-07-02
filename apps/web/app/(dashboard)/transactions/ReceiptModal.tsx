"use client";

import { Modal } from "antd";
import type { Invoice } from "@/lib/types";
import { formatAmount, formatDateTime } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-subtle py-2.5 last:border-b-0">
      <span className="text-[12.5px] text-text-muted">{label}</span>
      <span className="text-right text-[12.5px] text-text-primary">{value}</span>
    </div>
  );
}

export function ReceiptModal({
  invoice,
  onClose,
}: {
  invoice: Invoice | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={invoice !== null}
      onCancel={onClose}
      footer={null}
      title="Invoice receipt"
      width={440}
    >
      {invoice && (
        <div className="mt-2">
          <div className="mb-4 text-center">
            <div className="text-[27px] font-bold text-text-primary">
              {formatAmount(invoice.amount, invoice.asset)}
            </div>
            <div className="mt-1">
              <StatusBadge status={invoice.status} />
            </div>
          </div>
          <Row label="Invoice ID" value={<span className="font-mono">{invoice.id}</span>} />
          <Row
            label="Payment hash"
            value={<span className="font-mono break-all">{invoice.payment_hash}</span>}
          />
          <Row
            label="Address"
            value={<span className="font-mono break-all">{invoice.invoice_address}</span>}
          />
          {invoice.description && (
            <Row label="Description" value={invoice.description} />
          )}
          <Row label="Created" value={formatDateTime(invoice.created_at)} />
          {invoice.paid_at && (
            <Row label="Paid" value={formatDateTime(invoice.paid_at)} />
          )}
          <Row label="Expires" value={formatDateTime(invoice.expires_at)} />
        </div>
      )}
    </Modal>
  );
}
