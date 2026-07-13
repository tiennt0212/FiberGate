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

// Bounds the initial TCP connect + WS upgrade. Without this, a connection
// attempt that never completes (SYN silently dropped, e.g. mid-`docker
// restart fiber-node`) leaves the returned promise pending forever — nothing
// ever calls invoice-listener.ts's reconnect logic, permanently wedging the
// listener with the fallback poller as the only thing still working. `ws`'s
// own `handshakeTimeout` option surfaces this as a normal "error" event,
// which the existing handler below already rejects on.
//
// This only covers the TCP-connect-through-WS-upgrade phase, though — `ws`
// clears this timer the moment "open" fires (verified against `ws`'s own
// source). It does NOT bound the subscribe_store_changes *response* that
// comes after "open". SUBSCRIBE_RESPONSE_TIMEOUT_MS below covers that
// separate window.
const HANDSHAKE_TIMEOUT_MS = 10_000;

// Bounds the wait for FNN's response to the subscribe_store_changes request
// sent in the "open" handler. Without this, a node that completes the WS
// upgrade but never replies (or replies so late it's indistinguishable from
// never) leaves the returned promise pending forever — the same
// permanently-wedged-listener failure mode HANDSHAKE_TIMEOUT_MS guards
// against one phase earlier, just past the point that timer stops covering.
// Matches BR-POL-004's 5s bound on other Fiber RPC calls.
const SUBSCRIBE_RESPONSE_TIMEOUT_MS = 5_000;

// Detects an already-subscribed connection that goes silent without a clean
// TCP close — the standard `ws` liveness recipe (ping every interval, if the
// previous ping's pong never arrived, terminate()). This matters here
// specifically because Docker's NAT/port-forwarding to a restarted container
// can leave an established connection black-holed with no FIN/RST ever
// reaching this client, so the "close" event (subscribe-client.ts's only
// other way of noticing a dead connection) never fires either — confirmed
// live: after `docker restart fiber-node`, a listener connected before the
// restart stayed in "connected" status indefinitely while payments kept
// landing, silently falling back to the 30s poller with no error logged.
const HEARTBEAT_INTERVAL_MS = 15_000;

const SUBSCRIBE_REQUEST_ID = 1;
const UNSUBSCRIBE_REQUEST_ID = 2;

interface JsonRpcMessage {
  // Present on the handshake response (request id echoed back) — checked
  // against SUBSCRIBE_REQUEST_ID below so a same-shaped message could never
  // be misattributed as our handshake response (only one request is ever in
  // flight before subscribing today, so this is currently just defense in
  // depth, not a live bug).
  id?: number;
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
      handshakeTimeout: HANDSHAKE_TIMEOUT_MS,
    });

    let subscriptionId: JsonRpcSubscriptionId | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let subscribeTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let awaitingPong = false;
    // Two distinct flags, not one: promiseSettled just guards against a
    // double resolve()/reject() call; subscribed additionally gates whether
    // "close" should notify the caller via onClose at all. A handshake-time
    // rejection (bad response, RPC error, socket error before subscribing)
    // must NOT also fire onClose — the caller never got a subscription to
    // react to, only the rejected promise.
    let promiseSettled = false;
    let subscribed = false;
    let lastError: Error | undefined;

    function clearSubscribeTimeout(): void {
      if (subscribeTimeoutTimer) {
        clearTimeout(subscribeTimeoutTimer);
        subscribeTimeoutTimer = null;
      }
    }

    ws.on("open", () => {
      ws.send(JSON.stringify({ jsonrpc: "2.0", id: SUBSCRIBE_REQUEST_ID, method: SUBSCRIBE_METHOD, params: [] }));
      // See SUBSCRIBE_RESPONSE_TIMEOUT_MS's doc comment — handshakeTimeout
      // stops covering the connection the moment "open" fires, so a node
      // that upgrades the socket but never answers this request needs its
      // own bound here.
      subscribeTimeoutTimer = setTimeout(() => {
        promiseSettled = true;
        reject(
          new Error(`${SUBSCRIBE_METHOD} did not respond within ${SUBSCRIBE_RESPONSE_TIMEOUT_MS}ms`),
        );
        ws.terminate();
      }, SUBSCRIBE_RESPONSE_TIMEOUT_MS);
    });

    // Starts the heartbeat and resolves the outer promise once the handshake
    // response confirms the subscription id — pulled out of the "message"
    // handler below purely to keep that handler a flat sequence of early
    // returns instead of nesting this ~30-line setup two levels deep.
    function confirmSubscription(id: JsonRpcSubscriptionId): void {
      clearSubscribeTimeout();
      subscriptionId = id;
      promiseSettled = true;
      subscribed = true;
      heartbeatTimer = setInterval(() => {
        if (awaitingPong) {
          // Missed a full interval with no pong — the connection is dead but
          // never told us. terminate() (not close()) forces the socket
          // closed immediately without waiting for a graceful close
          // handshake that a black-holed connection will never complete; it
          // still synthesizes a "close" event below, which is what actually
          // notifies invoice-listener.ts to reconnect.
          ws.terminate();
          return;
        }
        awaitingPong = true;
        ws.ping();
      }, HEARTBEAT_INTERVAL_MS);
      resolve({
        close: () => {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                jsonrpc: "2.0",
                id: UNSUBSCRIBE_REQUEST_ID,
                method: UNSUBSCRIBE_METHOD,
                params: [subscriptionId],
              }),
            );
          }
          ws.close();
        },
      });
    }

    ws.on("message", (data: RawData) => {
      let parsed: JsonRpcMessage;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return; // ignore malformed frames rather than crashing the listener
      }

      if (subscribed) {
        if (parsed.method === NOTIFICATION_METHOD && parsed.params?.subscription === subscriptionId) {
          onEvent(parsed.params.result as StoreChange);
        }
        return;
      }

      // Correlate by id, not just shape — only one request is ever in
      // flight before subscribing today, so this is currently defense in
      // depth rather than a fix for a live misattribution.
      if (parsed.id !== SUBSCRIBE_REQUEST_ID) {
        return;
      }

      if (parsed.error) {
        clearSubscribeTimeout();
        promiseSettled = true;
        reject(new Error(`${SUBSCRIBE_METHOD} rejected: ${parsed.error.message}`));
        ws.close();
        return;
      }

      if (typeof parsed.result === "string" || typeof parsed.result === "number") {
        confirmSubscription(parsed.result);
      }
    });

    ws.on("pong", () => {
      awaitingPong = false;
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
      clearSubscribeTimeout();
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (subscribed) {
        onClose(lastError);
      }
    });
  });
}
