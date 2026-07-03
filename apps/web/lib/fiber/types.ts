import type { CkbInvoiceStatus } from "@ckb-ccc/fiber";

// FiberGate-facing wrapper types for lib/fiber/client.ts, kept separate from
// @ckb-ccc/fiber's own SDK types so no other file needs to import the SDK
// directly — that import stays confined to client.ts.

// Only "CKB" is implemented by createInvoice() today; anything else (e.g.
// "RUSD"/any UDT) throws UnsupportedAssetError. Full UDT/RUSD support is
// tracked in issue #27.
export type FiberAsset = string;

export interface NewInvoiceInput {
  /** Shannon (1 CKB = 10^8 shannon), matching invoices.amount_shannon. */
  amountShannon: bigint;
  asset: FiberAsset;
  description?: string;
}

export interface NewInvoiceOutput {
  invoiceAddress: string;
  /** 0x-prefixed hex; derived from paymentPreimage (hash = H(preimage)). */
  paymentHash: string;
  /**
   * 0x-prefixed hex HTLC secret, generated inside createInvoice() — never
   * supplied by the caller. Returned so a future issue (the POST /invoices
   * route, which owns DB writes) can decide whether to persist it.
   */
  paymentPreimage: string;
}

// Raw node-reported invoice state — not the same vocabulary as
// invoices.status (BR-STS-001); mapping one onto the other is the poller's
// job, not this file's.
export type InvoiceStatus = CkbInvoiceStatus;

export interface InvoiceStatusResult {
  invoiceAddress: string;
  status: InvoiceStatus;
}

// Field names mirror the node_snapshots table so a future poller/route can
// persist this directly. Capacity fields are raw shannon bigints; converting
// to the _ckb units shown in GET /node/info is left to that future layer.
export interface FiberNodeInfo {
  pubkey: string;
  totalChannels: number;
  activeChannels: number;
  inboundCapacityShannon: bigint;
  outboundCapacityShannon: bigint;
  peerCount: number;
}

// Thrown when a Fiber RPC call exceeds the 5s bound (BR-POL-004). Callers
// must catch this specifically to skip + log without changing invoice
// status — lib/fiber/ has no DB access to enforce that itself.
export class FiberRpcTimeoutError extends Error {
  constructor(
    public readonly rpcMethod: string,
    public readonly timeoutMs: number,
    cause: unknown,
  ) {
    super(
      `Fiber RPC method "${rpcMethod}" did not respond within ${timeoutMs}ms (BR-POL-004)`,
      { cause },
    );
    this.name = "FiberRpcTimeoutError";
  }
}

// Thrown by createInvoice() for any asset that isn't native CKB. Full
// UDT/RUSD support is tracked in issue #27.
export class UnsupportedAssetError extends Error {
  constructor(public readonly asset: string) {
    super(
      `Unsupported asset: ${asset} (UDT invoices not yet supported, see issue #27)`,
    );
    this.name = "UnsupportedAssetError";
  }
}
