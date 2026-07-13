import WebSocket, { type RawData } from "ws";

import { getOptionalEnv, requireEnv } from "../env";
import type { InvoiceStatus } from "./types";

// Dedicated WebSocket JSON-RPC client for FNN's `pubsub` module (issue #13,
// Phase 2 real-time invoice listener). Deliberately NOT built on
// @ckb-ccc/fiber — verified against that SDK's installed source that
// FiberSDK only wraps ccc.RequestorJsonRpc (request/response over HTTP), no
// subscribe_store_changes support anywhere in it (decisions-log.md
// 2026-07-01). This file only owns the wire protocol (jsonrpsee's
// subscription handshake + notification framing) for exactly one
// connection attempt — reconnect lifecycle and what to do with each event
// lives in lib/poller/invoice-listener.ts, kept separate so this file stays
// unit-testable without fake timers.

// subscribe_store_changes rides the same jsonrpsee server as the plain HTTP
// RPC calls in lib/fiber/client.ts (confirmed in FNN's rpc-reference docs),
// just over a WS upgrade instead of HTTP — so the WS URL is FIBER_NODE_URL
// with only the scheme swapped.
function resolveWsUrl(): string {
  const httpUrl = new URL(requireEnv("FIBER_NODE_URL"));
  httpUrl.protocol = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  return httpUrl.toString();
}

// Subset of FNN's StoreChange enum (crates/fiber-lib/src/store/store_impl/mod.rs)
// this client cares about. Externally-tagged JSON — that type derives plain
// serde::Serialize with no #[serde(tag = ...)], verified against FNN source
// at the pinned fiber-node image tag — e.g.
// { "PutCkbInvoiceStatus": { "payment_hash": "0x...", "invoice_status": "Open" } }.
// The other variants (PutPreimage/PutPaymentSession/PutAttempt) are typed
// loosely here since this client never reads their fields — BR-POL-005's
// variant filter happens one layer up, in invoice-listener.ts.
export type StoreChange =
  | { PutCkbInvoiceStatus: { payment_hash: string; invoice_status: InvoiceStatus } }
  | { PutPreimage: Record<string, unknown> }
  | { PutPaymentSession: Record<string, unknown> }
  | { PutAttempt: Record<string, unknown> };

const SUBSCRIBE_METHOD = "subscribe_store_changes";
const UNSUBSCRIBE_METHOD = "unsubscribe_store_changes";
const NOTIFICATION_METHOD = "store_changes";

interface JsonRpcMessage {
  // Present on the handshake response (request id echoed back).
  result?: unknown;
  error?: { code: number; message: string };
  // Present on every subsequent `store_changes` push (jsonrpsee subscription
  // framing: no top-level `id`, instead `method` + `params.subscription`).
  method?: string;
  params?: { subscription: JsonRpcSubscriptionId; result: unknown };
}

// Live-verified against a running fiber-node (0.9.0-rc6, issue #13): the
// handshake's `result` — and every later notification's `params.subscription`
// — comes back as a bare JSON *number* (e.g. 3947643073061732), not the
// string every generic jsonrpsee subscription-id example shows. Accepting
// only strings here made this client hang forever waiting for a
// notification that would never arrive as expected — caught by running the
// real handshake against docker's nervos/fiber:0.9.0-rc6 image before
// declaring this done, not just unit tests with an invented shape.
type JsonRpcSubscriptionId = string | number;

export interface StoreChangeSubscription {
  /** Best-effort unsubscribe, then closes the socket. Safe to call once. */
  close: () => void;
}

/**
 * Opens exactly one WebSocket connection and completes the
 * subscribe_store_changes handshake. Resolves once subscribed; every
 * StoreChange notification after that goes to `onEvent`. `onClose` fires
 * exactly once, only after a successful subscribe, whenever the connection
 * ends for any reason (remote close, network error, or the returned
 * `close()` being called) — the caller (invoice-listener.ts) decides whether
 * to reconnect. Rejects instead of resolving if the connection or handshake
 * itself fails before ever subscribing.
 */
export function subscribeToStoreChanges(
  onEvent: (change: StoreChange) => void,
  onClose: (error?: Error) => void,
): Promise<StoreChangeSubscription> {
  return new Promise((resolve, reject) => {
    const authToken = getOptionalEnv("FIBER_NODE_RPC_AUTH_TOKEN");
    const ws = new WebSocket(resolveWsUrl(), {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    });

    let subscriptionId: JsonRpcSubscriptionId | null = null;
    // Two distinct flags, not one: promiseSettled just guards against a
    // double resolve()/reject() call; subscribed additionally gates whether
    // "close" should notify the caller via onClose at all. A handshake-time
    // rejection (bad response, RPC error, socket error before subscribing)
    // must NOT also fire onClose — the caller never got a subscription to
    // react to, only the rejected promise.
    let promiseSettled = false;
    let subscribed = false;
    let lastError: Error | undefined;

    ws.on("open", () => {
      ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: SUBSCRIBE_METHOD, params: [] }));
    });

    ws.on("message", (data: RawData) => {
      let parsed: JsonRpcMessage;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return; // ignore malformed frames rather than crashing the listener
      }

      if (!subscribed) {
        if (parsed.error) {
          promiseSettled = true;
          reject(new Error(`${SUBSCRIBE_METHOD} rejected: ${parsed.error.message}`));
          ws.close();
          return;
        }
        if (typeof parsed.result === "string" || typeof parsed.result === "number") {
          subscriptionId = parsed.result;
          promiseSettled = true;
          subscribed = true;
          resolve({
            close: () => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(
                  JSON.stringify({
                    jsonrpc: "2.0",
                    id: 2,
                    method: UNSUBSCRIBE_METHOD,
                    params: [subscriptionId],
                  }),
                );
              }
              ws.close();
            },
          });
        }
        return;
      }

      if (parsed.method === NOTIFICATION_METHOD && parsed.params?.subscription === subscriptionId) {
        onEvent(parsed.params.result as StoreChange);
      }
    });

    ws.on("error", (error: Error) => {
      lastError = error;
      if (!promiseSettled) {
        promiseSettled = true;
        reject(error);
      }
      // If already subscribed, "close" (ws always emits it after "error")
      // is the single source of truth for reporting this to the caller —
      // see the "close" handler below.
    });

    ws.on("close", () => {
      if (subscribed) {
        onClose(lastError);
      }
    });
  });
}
