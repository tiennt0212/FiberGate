import { randomBytes } from "node:crypto";
import { fiber } from "@ckb-ccc/fiber";
import { env } from "@/lib/config/env";
import type { InvoiceStatusValue } from "@/lib/invoices/constants";

const NODE_TIMEOUT_MS = 5_000; // BR-POL-004

export class FiberNodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiberNodeError";
  }
}

const globalForFiber = globalThis as unknown as {
  __fibergateSdk?: fiber.FiberSDK;
};

function sdk(): fiber.FiberSDK {
  if (!globalForFiber.__fibergateSdk) {
    globalForFiber.__fibergateSdk = new fiber.FiberSDK({
      endpoint: env.fiberNodeUrl,
      timeout: NODE_TIMEOUT_MS,
    });
  }
  return globalForFiber.__fibergateSdk;
}

function hexToBigInt(hex: string | undefined): bigint {
  if (!hex) return 0n;
  return BigInt(hex);
}

/** Map the Fiber node's invoice status onto our terminal-state model (BR-STS-*). */
export function mapFiberStatus(status: fiber.CkbInvoiceStatus): InvoiceStatusValue {
  switch (status) {
    case "Paid":
    case "Received": // funds have arrived on an auto-settling invoice → treat as paid
      return "paid";
    case "Expired":
      return "expired";
    case "Cancelled":
      return "failed";
    case "Open":
    default:
      return "pending";
  }
}

export interface CreatedInvoice {
  invoiceAddress: string;
  paymentHash: string;
}

export interface CreateInvoiceInput {
  amountShannon: bigint;
  asset: "CKB" | "RUSD";
  description?: string;
  expirySeconds: number;
}

/**
 * Ask the node to mint a new invoice (BR-INV-005). We generate a random preimage;
 * the node derives the payment_hash and auto-settles when the payment arrives.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<CreatedInvoice> {
  const paymentPreimage = `0x${randomBytes(32).toString("hex")}` as const;

  let udtTypeScript: fiber.NewInvoiceParamsLike["udtTypeScript"];
  if (input.asset === "RUSD") {
    udtTypeScript = await resolveUdtScript("RUSD");
  }

  try {
    const result = await sdk().newInvoice({
      amount: input.amountShannon,
      currency: env.fiberCurrency,
      paymentPreimage,
      description: input.description,
      expiry: BigInt(input.expirySeconds),
      udtTypeScript,
    });
    return {
      invoiceAddress: result.invoiceAddress,
      paymentHash: result.invoice.data.paymentHash,
    };
  } catch (err) {
    throw new FiberNodeError(`new_invoice failed: ${errMessage(err)}`);
  }
}

/** Query one invoice's current status. Returns null if the node has no record of it. */
export async function getInvoiceStatus(paymentHash: string): Promise<InvoiceStatusValue | null> {
  try {
    const result = await sdk().getInvoice(paymentHash);
    return mapFiberStatus(result.status);
  } catch (err) {
    if (/not found|no.*invoice/i.test(errMessage(err))) return null;
    throw new FiberNodeError(`get_invoice failed: ${errMessage(err)}`);
  }
}

export interface NodeSummary {
  pubkey: string;
  version: string;
  online: boolean;
  totalChannels: number;
  activeChannels: number;
  inboundCapacityShannon: bigint;
  outboundCapacityShannon: bigint;
  peerCount: number;
}

/** Fetch node identity + aggregate channel liquidity (US-004, GET /node/info). */
export async function getNodeSummary(): Promise<NodeSummary> {
  const info = await sdk().getNodeInfo();
  const channels = await sdk().listChannels({ includeClosed: false });

  let inbound = 0n;
  let outbound = 0n;
  let active = 0;
  for (const ch of channels) {
    inbound += hexToBigInt(ch.remoteBalance); // what we can receive
    outbound += hexToBigInt(ch.localBalance); // what we can send
    if (ch.enabled) active += 1;
  }

  return {
    pubkey: info.nodeId,
    version: info.version,
    online: true,
    totalChannels: channels.length,
    activeChannels: active,
    inboundCapacityShannon: inbound,
    outboundCapacityShannon: outbound,
    peerCount: Number(hexToBigInt(info.peersCount)),
  };
}

async function resolveUdtScript(name: string): Promise<fiber.NewInvoiceParamsLike["udtTypeScript"]> {
  const info = await sdk().getNodeInfo();
  const match = info.udtCfgInfos.find((u) => u.name.toUpperCase() === name.toUpperCase());
  if (!match) {
    throw new FiberNodeError(`Asset ${name} is not configured on this Fiber node`);
  }
  return match.script;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
