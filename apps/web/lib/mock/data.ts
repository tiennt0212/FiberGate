import type {
  Invoice,
  NodeInfo,
  WebhookDelivery,
  WebhookEndpoint,
} from "@/lib/types";

// Static mock data for the pure-UI build. No API/DB/Fiber node involved —
// swap these out for real fetches once the backend routes exist.

export const nodeInfo: NodeInfo = {
  pubkey: "02a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
  status: "online",
  active_channels: 3,
  inbound_capacity_ckb: 800,
  outbound_capacity_ckb: 400,
};

export const invoices: Invoice[] = [
  {
    id: "inv_9f2a7c11",
    invoice_address: "fibt1qxy8k3n0w2p5rvd7l9m4h6s8t1u3v5x7z9a2b4c6d8e0f",
    payment_hash: "0x8a3f1c9e2b7d4a6f0c1e5d8b2a4f7c9e0d3b6a1f8c2e5d7b",
    amount: 125.5,
    asset: "CKB",
    status: "paid",
    description: "Order #10231",
    paid_at: "2026-07-02T09:14:22Z",
    expires_at: "2026-07-02T10:00:00Z",
    created_at: "2026-07-02T09:00:00Z",
  },
  {
    id: "inv_7b1d4e88",
    invoice_address: "fibt1qab3c5d7e9f1g3h5i7j9k1l3m5n7o9p1q3r5s7t9u1v",
    payment_hash: "0x1f4e7a2c9b6d3f8a1c4e7b0d3a6f9c2e5b8d1a4f7c0e3b6d",
    amount: 49.0,
    asset: "RUSD",
    status: "pending",
    description: "Order #10232",
    paid_at: null,
    expires_at: "2026-07-02T11:30:00Z",
    created_at: "2026-07-02T10:30:00Z",
  },
  {
    id: "inv_3c8f2a55",
    invoice_address: "fibt1qmn5o7p9q1r3s5t7u9v1w3x5y7z9a1b3c5d7e9f1g3h",
    payment_hash: "0x2a5d8b1e4f7c0a3d6b9e2f5c8a1d4b7e0c3f6a9d2b5e8c1f",
    amount: 12.75,
    asset: "CKB",
    status: "expired",
    description: "Order #10228",
    paid_at: null,
    expires_at: "2026-07-01T18:00:00Z",
    created_at: "2026-07-01T17:00:00Z",
  },
  {
    id: "inv_5e0b9d22",
    invoice_address: "fibt1qcd7e9f1g3h5i7j9k1l3m5n7o9p1q3r5s7t9u1v3w5x",
    payment_hash: "0x9c2f5a8d1b4e7c0f3a6d9b2e5f8c1a4d7b0e3c6f9a2d5b8e",
    amount: 300.0,
    asset: "CKB",
    status: "paid",
    description: "Order #10225",
    paid_at: "2026-07-01T14:02:10Z",
    expires_at: "2026-07-01T15:00:00Z",
    created_at: "2026-07-01T14:00:00Z",
  },
  {
    id: "inv_1a6c3f77",
    invoice_address: "fibt1qef9g1h3i5j7k9l1m3n5o7p9q1r3s5t7u9v1w3x5y7z",
    payment_hash: "0x4d7a0c3f6b9e2d5a8f1c4b7e0d3a6f9c2b5e8d1a4f7c0b3e",
    amount: 88.25,
    asset: "RUSD",
    status: "failed",
    description: "Order #10221",
    paid_at: null,
    expires_at: "2026-07-01T12:00:00Z",
    created_at: "2026-07-01T11:00:00Z",
  },
];

export const webhookEndpoints: WebhookEndpoint[] = [
  {
    id: "wh_a1b2c3",
    url: "https://shop.example.com/api/fibergate/webhook",
    events: ["payment.paid", "invoice.expired"],
    is_active: true,
    created_at: "2026-06-28T08:00:00Z",
  },
  {
    id: "wh_d4e5f6",
    url: "https://staging.example.com/hooks/fiber",
    events: ["payment.paid"],
    is_active: false,
    created_at: "2026-06-30T15:20:00Z",
  },
];

export const webhookDeliveries: WebhookDelivery[] = [
  {
    id: "dlv_001",
    endpoint_id: "wh_a1b2c3",
    invoice_id: "inv_9f2a7c11",
    event_type: "payment.paid",
    http_status: 200,
    attempt_count: 1,
    status: "success",
    delivered_at: "2026-07-02T09:14:24Z",
    created_at: "2026-07-02T09:14:23Z",
  },
  {
    id: "dlv_002",
    endpoint_id: "wh_a1b2c3",
    invoice_id: "inv_3c8f2a55",
    event_type: "invoice.expired",
    http_status: 500,
    attempt_count: 3,
    status: "failed",
    delivered_at: null,
    created_at: "2026-07-01T18:00:05Z",
  },
  {
    id: "dlv_003",
    endpoint_id: "wh_a1b2c3",
    invoice_id: "inv_5e0b9d22",
    event_type: "payment.paid",
    http_status: 200,
    attempt_count: 1,
    status: "success",
    delivered_at: "2026-07-01T14:02:12Z",
    created_at: "2026-07-01T14:02:11Z",
  },
];
