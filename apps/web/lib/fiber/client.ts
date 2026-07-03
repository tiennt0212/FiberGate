import { randomBytes } from "node:crypto";

import { FiberSDK } from "@ckb-ccc/fiber";

import { requireEnv } from "../env";
import {
  FiberRpcTimeoutError,
  UnsupportedAssetError,
  type FiberNodeInfo,
  type InvoiceStatusResult,
  type NewInvoiceInput,
  type NewInvoiceOutput,
} from "./types";

// Single wrapper around every Fiber node RPC call — routes must use the
// exported functions below, never construct their own FiberSDK (CLAUDE.md).
// No subscribe_store_changes/WebSocket code here: that's Phase 2, and the
// installed SDK only supports request/response HTTP anyway.

// BR-POL-004: 5s hard timeout on every call. FiberSDK forwards this into a
// real AbortController that cancels the in-flight request (not just the
// connect), rejecting with an "AbortError" that callWithTimeout below
// converts into FiberRpcTimeoutError.
const RPC_TIMEOUT_MS = 5000;

// The SDK's Currency values encode network (like Lightning's lnbc/lntb
// prefixes). fiber-node here is testnet-only, so CKB always maps to Fibt.
const CKB_CURRENCY = "Fibt" as const;

// Singleton built once at import time, mirroring lib/db/index.ts. Not
// exported — callers must go through the wrapper functions below.
const sdk = new FiberSDK({
  endpoint: requireEnv("FIBER_NODE_URL"),
  timeout: RPC_TIMEOUT_MS,
});

// Optional Biscuit token. Read directly (not requireEnv) since undefined is
// valid — auth is off by default here. Exported because it's currently
// inert: the installed SDK's HTTP transport has no Authorization/Biscuit
// header hook, so this value has nowhere to go yet. Wiring it in needs a
// custom Transport (see decisions-log.md).
export const fiberNodeAuthToken = process.env.FIBER_NODE_RPC_AUTH_TOKEN;

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

// Converts an aborted (timed-out) call into FiberRpcTimeoutError so callers
// can distinguish it from other RPC errors with instanceof. Deciding what to
// do about a timeout (skip + log, never touch invoice status) is the
// caller's job — this file has no DB access.
async function callWithTimeout<T>(
  rpcMethod: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isAbortError(error)) {
      throw new FiberRpcTimeoutError(rpcMethod, RPC_TIMEOUT_MS, error);
    }
    throw error;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

function hexToNumber(hex: string): number {
  return Number(BigInt(hex));
}

// Generates the HTLC preimage here — the caller never supplies or sees it
// before creation. Returned alongside invoiceAddress/paymentHash so a future
// issue can persist it (this file has no DB access). Whether the node
// auto-settles once it recognizes the preimage, or needs an explicit
// settleInvoice call, is unconfirmed — verify against a live node before
// building the poller/settlement flow. Only CKB is supported; anything else
// throws UnsupportedAssetError (UDT/RUSD tracked in issue #27).
export async function createInvoice(
  input: NewInvoiceInput,
): Promise<NewInvoiceOutput> {
  if (input.asset !== "CKB") {
    throw new UnsupportedAssetError(input.asset);
  }

  const paymentPreimage = randomBytes(32);

  return callWithTimeout("new_invoice", async () => {
    const result = await sdk.newInvoice({
      amount: input.amountShannon,
      currency: CKB_CURRENCY,
      paymentPreimage,
      description: input.description,
    });

    return {
      invoiceAddress: result.invoiceAddress,
      paymentHash: result.invoice.data.paymentHash,
      paymentPreimage: bytesToHex(paymentPreimage),
    };
  });
}

// Returns the node's raw status — mapping it onto invoices.status
// (BR-STS-001) is the poller's job, not this file's.
export async function getInvoiceStatus(
  paymentHash: string,
): Promise<InvoiceStatusResult> {
  return callWithTimeout("get_invoice", async () => {
    const result = await sdk.getInvoice(paymentHash);
    return {
      invoiceAddress: result.invoiceAddress,
      status: result.status,
    };
  });
}

// getNodeInfo() has no capacity fields, so capacity is aggregated from
// listChannels() (localBalance = outbound, remoteBalance = inbound). Closed
// channels are excluded by default; only enabled ones count toward
// activeChannels/capacity.
export async function getNodeInfo(): Promise<FiberNodeInfo> {
  const [info, channels] = await Promise.all([
    callWithTimeout("node_info", () => sdk.getNodeInfo()),
    callWithTimeout("list_channels", () => sdk.listChannels()),
  ]);

  const activeChannels = channels.filter((channel) => channel.enabled);
  const inboundCapacityShannon = activeChannels.reduce(
    (sum, channel) => sum + hexToBigInt(channel.remoteBalance),
    0n,
  );
  const outboundCapacityShannon = activeChannels.reduce(
    (sum, channel) => sum + hexToBigInt(channel.localBalance),
    0n,
  );

  return {
    pubkey: info.pubkey,
    totalChannels: hexToNumber(info.channelCount),
    activeChannels: activeChannels.length,
    inboundCapacityShannon,
    outboundCapacityShannon,
    peerCount: hexToNumber(info.peersCount),
  };
}
