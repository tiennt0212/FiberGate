import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.FIBER_NODE_URL = "http://test-fiber-node:8227";

// Fake `ws` WebSocket: a real EventEmitter (so ws.on/emit behave exactly
// like the real client), tracking every send()/ping() call for assertions
// and letting each test drive open/message/error/close by hand — a real
// socket would need an actual FNN server to exercise the jsonrpsee handshake.
class FakeWebSocket extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
  pingCount = 0;
  terminated = false;
  url: string;
  options: unknown;

  constructor(url: string, options: unknown) {
    super();
    this.url = url;
    this.options = options;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  ping(): void {
    this.pingCount += 1;
  }

  terminate(): void {
    this.terminated = true;
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }
}

let lastSocket: FakeWebSocket | undefined;

vi.mock("ws", () => {
  const WebSocketMock = vi.fn().mockImplementation(function (url: string, options: unknown) {
    lastSocket = new FakeWebSocket(url, options);
    return lastSocket;
  });
  // subscribe-client.ts reads the class-level WebSocket.OPEN constant (not
  // an instance's) to decide whether it's still safe to send() — must match
  // FakeWebSocket's own OPEN value above.
  Object.assign(WebSocketMock, { OPEN: FakeWebSocket.OPEN, CLOSED: FakeWebSocket.CLOSED });
  return { default: WebSocketMock };
});

const { subscribeToStoreChanges } = await import("./subscribe-client");

beforeEach(() => {
  lastSocket = undefined;
  delete process.env.FIBER_NODE_RPC_AUTH_TOKEN;
});

afterEach(() => {
  // The heartbeat interval started on a successful subscribe (see
  // "heartbeat" describe block below) only gets cleared by a "close" event —
  // without this, a test that subscribes but never explicitly closes would
  // leak a live setInterval into later tests.
  lastSocket?.close();
});

function subscribeResponse(id = "sub-1"): string {
  return JSON.stringify({ jsonrpc: "2.0", id: 1, result: id });
}

function notification(subscription: string, result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", method: "store_changes", params: { subscription, result } });
}

describe("subscribeToStoreChanges", () => {
  it("derives a ws:// URL from FIBER_NODE_URL and sends the subscribe_store_changes handshake on open", async () => {
    const pending = subscribeToStoreChanges(vi.fn(), vi.fn());
    lastSocket!.emit("open");

    expect(lastSocket!.url).toBe("ws://test-fiber-node:8227/");
    expect(JSON.parse(lastSocket!.sent[0]!)).toMatchObject({
      jsonrpc: "2.0",
      method: "subscribe_store_changes",
      params: [],
    });

    lastSocket!.emit("message", Buffer.from(subscribeResponse()));
    await expect(pending).resolves.toMatchObject({ close: expect.any(Function) });
  });

  it("swaps https to wss", async () => {
    process.env.FIBER_NODE_URL = "https://test-fiber-node:8227";
    const pending = subscribeToStoreChanges(vi.fn(), vi.fn());
    lastSocket!.emit("open");
    expect(lastSocket!.url.startsWith("wss://")).toBe(true);

    lastSocket!.emit("message", Buffer.from(subscribeResponse()));
    await pending;
    process.env.FIBER_NODE_URL = "http://test-fiber-node:8227";
  });

  it("forwards FIBER_NODE_RPC_AUTH_TOKEN as an Authorization header when set", async () => {
    process.env.FIBER_NODE_RPC_AUTH_TOKEN = "test-token";
    const pending = subscribeToStoreChanges(vi.fn(), vi.fn());
    lastSocket!.emit("open");
    lastSocket!.emit("message", Buffer.from(subscribeResponse()));
    await pending;

    expect(lastSocket!.options).toMatchObject({ headers: { Authorization: "Bearer test-token" } });
  });

  it("omits the Authorization header when no token is configured", async () => {
    const pending = subscribeToStoreChanges(vi.fn(), vi.fn());
    lastSocket!.emit("open");
    lastSocket!.emit("message", Buffer.from(subscribeResponse()));
    await pending;

    expect(lastSocket!.options).toMatchObject({ headers: undefined });
  });

  it("dispatches a matching store_changes notification to onEvent", async () => {
    const onEvent = vi.fn();
    const pending = subscribeToStoreChanges(onEvent, vi.fn());
    lastSocket!.emit("open");
    lastSocket!.emit("message", Buffer.from(subscribeResponse("sub-42")));
    await pending;

    const change = { PutCkbInvoiceStatus: { payment_hash: "0xabc", invoice_status: "Paid" } };
    lastSocket!.emit("message", Buffer.from(notification("sub-42", change)));

    expect(onEvent).toHaveBeenCalledWith(change);
  });

  it("ignores a notification for a different subscription id", async () => {
    const onEvent = vi.fn();
    const pending = subscribeToStoreChanges(onEvent, vi.fn());
    lastSocket!.emit("open");
    lastSocket!.emit("message", Buffer.from(subscribeResponse("sub-42")));
    await pending;

    lastSocket!.emit(
      "message",
      Buffer.from(notification("some-other-subscription", { PutCkbInvoiceStatus: {} })),
    );

    expect(onEvent).not.toHaveBeenCalled();
  });

  it("ignores malformed JSON frames instead of throwing", async () => {
    const onEvent = vi.fn();
    const pending = subscribeToStoreChanges(onEvent, vi.fn());
    lastSocket!.emit("open");

    expect(() => lastSocket!.emit("message", Buffer.from("not json"))).not.toThrow();

    lastSocket!.emit("message", Buffer.from(subscribeResponse()));
    await expect(pending).resolves.toBeDefined();
  });

  it("rejects when FNN returns a JSON-RPC error for the handshake", async () => {
    const pending = subscribeToStoreChanges(vi.fn(), vi.fn());
    lastSocket!.emit("open");
    lastSocket!.emit(
      "message",
      Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "method not found" } })),
    );

    await expect(pending).rejects.toThrow(/method not found/);
  });

  it("rejects on a socket error before the handshake completes, without calling onClose", async () => {
    const onClose = vi.fn();
    const pending = subscribeToStoreChanges(vi.fn(), onClose);
    lastSocket!.emit("error", new Error("ECONNREFUSED"));

    await expect(pending).rejects.toThrow("ECONNREFUSED");
    lastSocket!.emit("close");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose (with the last error) when the connection drops after a successful subscribe", async () => {
    const onClose = vi.fn();
    const pending = subscribeToStoreChanges(vi.fn(), onClose);
    lastSocket!.emit("open");
    lastSocket!.emit("message", Buffer.from(subscribeResponse()));
    await pending;

    const socketError = new Error("connection reset");
    lastSocket!.emit("error", socketError);
    lastSocket!.emit("close");

    expect(onClose).toHaveBeenCalledWith(socketError);
  });

  it("close() sends unsubscribe_store_changes and closes the socket", async () => {
    const pending = subscribeToStoreChanges(vi.fn(), vi.fn());
    lastSocket!.emit("open");
    lastSocket!.emit("message", Buffer.from(subscribeResponse("sub-42")));
    const subscription = await pending;

    subscription.close();

    const unsubscribeCall = lastSocket!.sent.map((raw) => JSON.parse(raw)).find((msg) => msg.method === "unsubscribe_store_changes");
    expect(unsubscribeCall).toMatchObject({ params: ["sub-42"] });
    expect(lastSocket!.readyState).toBe(FakeWebSocket.CLOSED);
  });

  it("passes handshakeTimeout so a stuck connection attempt eventually errors out instead of hanging forever", async () => {
    subscribeToStoreChanges(vi.fn(), vi.fn());
    expect(lastSocket!.options).toMatchObject({ handshakeTimeout: 10_000 });
  });

  it("ignores a handshake-shaped message whose id doesn't match the subscribe request", async () => {
    const pending = subscribeToStoreChanges(vi.fn(), vi.fn());
    lastSocket!.emit("open");

    // Same shape as a real handshake response, but id: 99 instead of 1 — must
    // not be mistaken for our subscribe_store_changes response.
    lastSocket!.emit("message", Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: 99, result: "sub-wrong" })));
    lastSocket!.emit("message", Buffer.from(subscribeResponse("sub-1")));

    const subscription = await pending;
    subscription.close();
    const unsubscribeCall = lastSocket!.sent
      .map((raw) => JSON.parse(raw))
      .find((msg) => msg.method === "unsubscribe_store_changes");
    // Only "sub-1" (the correctly-id'd response) was ever adopted.
    expect(unsubscribeCall).toMatchObject({ params: ["sub-1"] });
  });
});

// Bug class found by live-testing (2026-07-13): `handshakeTimeout` only
// bounds the TCP-connect-through-WS-upgrade phase — `ws` clears that timer
// the instant "open" fires. A node that completes the upgrade but never
// replies to subscribe_store_changes would otherwise hang this promise
// forever, the same permanently-wedged-listener failure mode as the
// connect-phase hang HANDSHAKE_TIMEOUT_MS guards against.
describe("subscribeToStoreChanges — subscribe response timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects and terminates the connection if no response arrives within the timeout", async () => {
    const pending = subscribeToStoreChanges(vi.fn(), vi.fn());
    lastSocket!.emit("open");

    const assertion = expect(pending).rejects.toThrow(/did not respond/);
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;

    expect(lastSocket!.terminated).toBe(true);
  });

  it("does not reject if the response arrives before the timeout", async () => {
    const pending = subscribeToStoreChanges(vi.fn(), vi.fn());
    lastSocket!.emit("open");

    await vi.advanceTimersByTimeAsync(4_000);
    lastSocket!.emit("message", Buffer.from(subscribeResponse()));
    await expect(pending).resolves.toBeDefined();

    // The (now-cleared) timeout must not still fire and terminate a healthy,
    // already-subscribed connection.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(lastSocket!.terminated).toBe(false);
  });
});

// Bug found by live-testing against a real fiber-node (2026-07-13): after
// `docker restart fiber-node`, an already-subscribed connection stayed stuck
// reporting "connected" forever because the black-holed socket never fired
// "close" on its own — this heartbeat is what actually detects that and
// forces a close so invoice-listener.ts's reconnect logic gets a chance to
// run. Needs fake timers since HEARTBEAT_INTERVAL_MS is 15s real time.
describe("subscribeToStoreChanges — heartbeat liveness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pings on each heartbeat interval and terminates the connection if a pong never arrives", async () => {
    const onClose = vi.fn();
    const pending = subscribeToStoreChanges(vi.fn(), onClose);
    lastSocket!.emit("open");
    lastSocket!.emit("message", Buffer.from(subscribeResponse("sub-1")));
    await pending;

    await vi.advanceTimersByTimeAsync(15_000);
    expect(lastSocket!.pingCount).toBe(1);
    expect(lastSocket!.terminated).toBe(false); // one missed pong isn't enough yet

    // No "pong" emitted in between — the second interval tick finds the
    // first ping still unanswered.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(lastSocket!.terminated).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not terminate a connection that answers each ping with a pong", async () => {
    const pending = subscribeToStoreChanges(vi.fn(), vi.fn());
    lastSocket!.emit("open");
    lastSocket!.emit("message", Buffer.from(subscribeResponse("sub-1")));
    await pending;

    await vi.advanceTimersByTimeAsync(15_000);
    expect(lastSocket!.pingCount).toBe(1);
    lastSocket!.emit("pong");

    await vi.advanceTimersByTimeAsync(15_000);
    expect(lastSocket!.pingCount).toBe(2);
    expect(lastSocket!.terminated).toBe(false);
  });
});
