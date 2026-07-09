import type { CkbInvoiceStatus } from "@ckb-ccc/fiber";

// FiberGate-facing wrapper types for lib/fiber/client.ts, kept separate from
// @ckb-ccc/fiber's own SDK types so no other file needs to import the SDK
// directly — that import stays confined to client.ts.

// "CKB" and "RUSD" are implemented by createInvoice(); anything else throws
// UnsupportedAssetError. RUSD's UDT type script is resolved at runtime from
// the node's own udt_whitelist (see resolveUdtTypeScript() in client.ts),
// not hardcoded here — see decisions-log.md 2026-07-09 (issue #27).
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
  /** Real fields from sdk.getNodeInfo() — Overview's Node Status panel (issue #40). */
  version: string;
  commitHash: string;
  totalChannels: number;
  activeChannels: number;
  inboundCapacityShannon: bigint;
  outboundCapacityShannon: bigint;
  peerCount: number;
}

// Channels/Peers pages (issue #40 follow-up) — per-item detail that
// getNodeInfo() above deliberately throws away by aggregating into counts.
export interface FiberChannelState {
  /** Raw Fiber state name, e.g. "CHANNEL_READY", "SHUTTING_DOWN". */
  stateName: string;
  stateFlags: string;
}

export interface FiberChannel {
  channelId: string;
  peerPubkey: string;
  isPublic: boolean;
  channelOutpoint: string;
  /**
   * "CKB" when the channel has no funding UDT type script (native asset);
   * otherwise the matched name from this node's udt_whitelist (e.g. "RUSD"),
   * or "UNKNOWN_UDT" if the funding script doesn't match any configured UDT.
   * Resolved inside client.ts (same udt_whitelist cache createInvoice() uses)
   * so no other file needs to import/compare raw Script values.
   */
  asset: string;
  state: FiberChannelState;
  localBalanceShannon: bigint;
  remoteBalanceShannon: bigint;
  /** Value currently locked in in-flight TLCs — not spendable until settled. */
  offeredTlcBalanceShannon: bigint;
  receivedTlcBalanceShannon: bigint;
  /**
   * Epoch milliseconds, assuming the SDK's createdAt hex encodes ms since
   * epoch like other CKB/Fiber timestamps — unconfirmed against a live node,
   * verify before trusting sub-day display precision.
   */
  createdAt: number;
  enabled: boolean;
  tlcExpiryDelta: bigint;
  tlcFeeProportionalMillionths: bigint;
  latestCommitmentTransactionHash?: string;
  shutdownTransactionHash?: string;
}

export interface FiberPeer {
  pubkey: string;
  address: string;
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

// Thrown by createInvoice() for any asset other than "CKB"/"RUSD"
// (BR-INV-002) — the only two FiberGate implements.
export class UnsupportedAssetError extends Error {
  constructor(public readonly asset: string) {
    super(`Unsupported asset: ${asset} (FiberGate only supports CKB and RUSD)`);
    this.name = "UnsupportedAssetError";
  }
}

// Thrown when asset is "RUSD" (a FiberGate-supported asset) but this
// particular node's ckb.udt_whitelist (docker/fiber-node/config.yml) doesn't
// have it configured — distinct from UnsupportedAssetError so ops can tell
// "FiberGate can't do this" apart from "this node needs its config fixed".
export class UdtNotConfiguredError extends Error {
  constructor(public readonly asset: string) {
    super(
      `Asset "${asset}" is not in this Fiber node's udt_whitelist (check docker/fiber-node/config.yml's ckb.udt_whitelist)`,
    );
    this.name = "UdtNotConfiguredError";
  }
}
