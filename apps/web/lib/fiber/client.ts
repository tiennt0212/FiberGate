import { randomBytes } from "node:crypto";

import { FiberSDK, type UdtArgInfo } from "@ckb-ccc/fiber";

import { requireEnv } from "../env";
import {
  FiberRpcTimeoutError,
  UdtNotConfiguredError,
  UnsupportedAssetError,
  type FiberAsset,
  type FiberChannel,
  type FiberNodeInfo,
  type FiberPeer,
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

// The SDK's Currency values encode network only (like Lightning's lnbc/lntb
// prefixes) — orthogonal to which asset (CKB or a UDT like RUSD) the invoice
// is denominated in, that's a separate udtTypeScript field. fiber-node here
// is testnet-only, so every invoice uses Fibt regardless of asset.
const INVOICE_CURRENCY = "Fibt" as const;

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

// UDT type scripts (keyed by name), resolved from node_info's udtCfgInfos
// (docker/fiber-node/config.yml's ckb.udt_whitelist) and cached for the
// process lifetime — that whitelist rarely changes, so a fresh RPC call per
// RUSD invoice would usually just be redundant load (human decision, issue
// #27). Stored as an in-flight *promise*, not a resolved value: caching only
// the value left a check-then-act race where concurrent callers arriving
// before the first node_info response landed would each fire their own RPC.
// Sharing the same promise means every concurrent caller awaits one RPC call.
let udtScriptsPromise: Promise<Map<string, UdtArgInfo["script"]>> | null = null;

async function fetchUdtScripts(): Promise<Map<string, UdtArgInfo["script"]>> {
  const info = await callWithTimeout("node_info", () => sdk.getNodeInfo());
  if (!Array.isArray(info.udtCfgInfos)) {
    throw new Error(
      "Fiber node's node_info response is missing udtCfgInfos — check the node version matches the pinned @ckb-ccc/fiber SDK's expected shape",
    );
  }
  return new Map(info.udtCfgInfos.map((cfg) => [cfg.name, cfg.script]));
}

// Loads (and memoizes) the node's udt_whitelist. On failure, clears the
// cache before rethrowing so the *next* call retries from scratch — a
// transient RPC timeout must not get "stuck" as a permanently cached
// rejection.
function loadUdtScripts(): Promise<Map<string, UdtArgInfo["script"]>> {
  if (!udtScriptsPromise) {
    udtScriptsPromise = fetchUdtScripts().catch((error: unknown) => {
      udtScriptsPromise = null;
      throw error;
    });
  }
  return udtScriptsPromise;
}

// Only "CKB" and "RUSD" are FiberGate-supported assets (BR-INV-002); anything
// else fails fast without an RPC call. For "CKB", newInvoice() needs no
// udtTypeScript at all (native asset). For "RUSD", the SDK's newInvoice()
// takes the *same* currency/amount params as CKB plus one extra field,
// udtTypeScript — UDT invoices are not a separate RPC method or code path,
// verified by reading the installed @ckb-ccc/fiber's own
// src/types/invoice.ts (NewInvoiceParamsLike.udtTypeScript).
async function resolveUdtTypeScript(
  asset: FiberAsset,
): Promise<UdtArgInfo["script"] | undefined> {
  if (asset === "CKB") {
    return undefined;
  }
  if (asset !== "RUSD") {
    throw new UnsupportedAssetError(asset);
  }

  const scripts = await loadUdtScripts();
  const script = scripts.get(asset);
  if (!script) {
    // Don't remember "not configured" forever: an operator may fix
    // ckb.udt_whitelist and restart just fiber-node (which does NOT restart
    // this container — docker-compose's depends_on only governs startup
    // order, not restart propagation). Clearing the cache here lets the
    // *next* RUSD invoice attempt re-check instead of failing until someone
    // separately restarts fibergate-core.
    udtScriptsPromise = null;
    throw new UdtNotConfiguredError(asset);
  }
  return script;
}

// Generates the HTLC preimage here — the caller never supplies or sees it
// before creation. Returned alongside invoiceAddress/paymentHash so a future
// issue can persist it (this file has no DB access). Whether the node
// auto-settles once it recognizes the preimage, or needs an explicit
// settleInvoice call, is unconfirmed — verify against a live node before
// building the poller/settlement flow.
export async function createInvoice(
  input: NewInvoiceInput,
): Promise<NewInvoiceOutput> {
  const udtTypeScript = await resolveUdtTypeScript(input.asset);
  const paymentPreimage = randomBytes(32);

  return callWithTimeout("new_invoice", async () => {
    const result = await sdk.newInvoice({
      amount: input.amountShannon,
      currency: INVOICE_CURRENCY,
      paymentPreimage,
      description: input.description,
      udtTypeScript,
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
    version: info.version,
    commitHash: info.commitHash,
    totalChannels: hexToNumber(info.channelCount),
    activeChannels: activeChannels.length,
    inboundCapacityShannon,
    outboundCapacityShannon,
    peerCount: hexToNumber(info.peersCount),
  };
}

// Resolves a channel's funding UDT type script to the FiberGate-facing asset
// name ("CKB" for a native channel, else the matching name from this node's
// udt_whitelist, or "UNKNOWN_UDT" if the script doesn't match anything
// configured) — same udt_whitelist cache createInvoice()/resolveUdtTypeScript()
// use, kept private to this file so callers never see a raw ccc.Script.
function resolveChannelAssetName(
  fundingUdtTypeScript: UdtArgInfo["script"] | undefined,
  udtScripts: Map<string, UdtArgInfo["script"]> | null,
): string {
  if (!fundingUdtTypeScript) {
    return "CKB";
  }
  for (const [name, script] of udtScripts ?? []) {
    if (fundingUdtTypeScript.eq(script)) {
      return name;
    }
  }
  return "UNKNOWN_UDT";
}

// Channels page (issue #40 follow-up) — per-channel detail that
// getNodeInfo() above deliberately discards by aggregating into counts.
// Only fetches the udt_whitelist (an extra node_info RPC, memoized by
// loadUdtScripts()) when at least one channel actually needs it, so an
// all-CKB node never pays for it.
export async function listChannelsDetailed(): Promise<FiberChannel[]> {
  const channels = await callWithTimeout("list_channels", () => sdk.listChannels());
  const hasUdtChannel = channels.some((channel) => channel.fundingUdtTypeScript !== undefined);
  const udtScripts = hasUdtChannel ? await loadUdtScripts() : null;

  return channels.map((channel) => ({
    channelId: channel.channelId,
    peerPubkey: channel.pubkey,
    isPublic: channel.isPublic,
    channelOutpoint: channel.channelOutpoint,
    asset: resolveChannelAssetName(channel.fundingUdtTypeScript, udtScripts),
    state: channel.state,
    localBalanceShannon: hexToBigInt(channel.localBalance),
    remoteBalanceShannon: hexToBigInt(channel.remoteBalance),
    offeredTlcBalanceShannon: hexToBigInt(channel.offeredTlcBalance),
    receivedTlcBalanceShannon: hexToBigInt(channel.receivedTlcBalance),
    createdAt: hexToNumber(channel.createdAt),
    enabled: channel.enabled,
    tlcExpiryDelta: hexToBigInt(channel.tlcExpiryDelta),
    tlcFeeProportionalMillionths: hexToBigInt(channel.tlcFeeProportionalMillionths),
    latestCommitmentTransactionHash: channel.latestCommitmentTransactionHash,
    shutdownTransactionHash: channel.shutdownTransactionHash,
  }));
}

// Peers page (issue #40 follow-up). sdk.listPeers() only ever returns
// pubkey/address (see @ckb-ccc/fiber's PeerInfo type) — there is nothing else
// to surface here, deliberately not padded out with invented fields.
export async function listPeersDetailed(): Promise<FiberPeer[]> {
  const peers = await callWithTimeout("list_peers", () => sdk.listPeers());
  return peers.map((peer) => ({ pubkey: peer.pubkey, address: peer.address }));
}
