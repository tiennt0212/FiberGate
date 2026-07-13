import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreChange } from "@/lib/fiber/subscribe-client";

vi.mock("@/lib/fiber/subscribe-client", () => ({
  subscribeToStoreChanges: vi.fn(),
}));
vi.mock("./invoice-poller", () => ({
  applyInvoiceStatusUpdate: vi.fn(),
}));

const { subscribeToStoreChanges } = await import("@/lib/fiber/subscribe-client");
const { applyInvoiceStatusUpdate } = await import("./invoice-poller");
const { startInvoiceListener, stopInvoiceListener } = await import("./invoice-listener");

// subscribeToStoreChanges() is (onEvent, onClose) => Promise<{ close }> — a
// deferred promise per call lets each test drive open/close by hand instead
// of racing real async resolution, and captures the handlers the listener
// registered so a test can simulate a server-pushed event or a dropped
// connection.
interface Deferred {
  resolve: (sub: { close: () => void }) => void;
  reject: (error: Error) => void;
  onEvent: (change: StoreChange) => void;
  onClose: (error?: Error) => void;
  closeSpy: () => void;
}

function mockNextConnectAttempt(): Deferred {
  const closeSpy = vi.fn((): void => {});
  let resolve!: (sub: { close: () => void }) => void;
  let reject!: Deferred["reject"];
  let onEvent!: Deferred["onEvent"];
  let onClose!: Deferred["onClose"];

  vi.mocked(subscribeToStoreChanges).mockImplementationOnce((ev, cl) => {
    onEvent = ev;
    onClose = cl;
    return new Promise((res, rej) => {
      resolve = (sub) => res(sub);
      reject = rej;
    });
  });

  return {
    resolve: (sub) => resolve(sub),
    reject: (error) => reject(error),
    onEvent: (change) => onEvent(change),
    onClose: (error) => onClose(error),
    closeSpy,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  stopInvoiceListener();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("startInvoiceListener", () => {
  it("connects once and adopts the resolved subscription", async () => {
    const attempt = mockNextConnectAttempt();
    startInvoiceListener();
    attempt.resolve({ close: vi.fn() });
    await vi.waitFor(() => expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1));
  });

  it("is a no-op if called again while already connected", async () => {
    const attempt = mockNextConnectAttempt();
    startInvoiceListener();
    attempt.resolve({ close: vi.fn() });
    await vi.waitFor(() => expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1));

    startInvoiceListener();
    expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1);
  });

  it("forwards a PutCkbInvoiceStatus event to applyInvoiceStatusUpdate", async () => {
    const attempt = mockNextConnectAttempt();
    startInvoiceListener();
    attempt.resolve({ close: vi.fn() });
    await vi.waitFor(() => expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1));

    vi.mocked(applyInvoiceStatusUpdate).mockResolvedValue(undefined);
    attempt.onEvent({ PutCkbInvoiceStatus: { payment_hash: "0xabc", invoice_status: "Paid" } });

    expect(applyInvoiceStatusUpdate).toHaveBeenCalledWith("0xabc", "Paid");
  });

  it("ignores non-PutCkbInvoiceStatus variants (BR-POL-005)", async () => {
    const attempt = mockNextConnectAttempt();
    startInvoiceListener();
    attempt.resolve({ close: vi.fn() });
    await vi.waitFor(() => expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1));

    attempt.onEvent({ PutPreimage: { payment_hash: "0xabc" } });

    expect(applyInvoiceStatusUpdate).not.toHaveBeenCalled();
  });

  it("logs and continues if applyInvoiceStatusUpdate rejects", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const attempt = mockNextConnectAttempt();
    startInvoiceListener();
    attempt.resolve({ close: vi.fn() });
    await vi.waitFor(() => expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1));

    vi.mocked(applyInvoiceStatusUpdate).mockRejectedValueOnce(new Error("db down"));
    attempt.onEvent({ PutCkbInvoiceStatus: { payment_hash: "0xabc", invoice_status: "Paid" } });

    await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    consoleErrorSpy.mockRestore();
  });

  it("reconnects with backoff after the connection drops", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const first = mockNextConnectAttempt();
    startInvoiceListener();
    first.resolve({ close: vi.fn() });
    await vi.waitFor(() => expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1));

    const second = mockNextConnectAttempt();
    first.onClose(new Error("connection reset"));

    // First backoff is 1s — nothing happens before then.
    await vi.advanceTimersByTimeAsync(999);
    expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(subscribeToStoreChanges).toHaveBeenCalledTimes(2);
    second.resolve({ close: vi.fn() });
    await vi.waitFor(() => Promise.resolve());

    consoleErrorSpy.mockRestore();
  });

  it("retries with backoff if the connect attempt itself rejects", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const first = mockNextConnectAttempt();
    startInvoiceListener();

    const second = mockNextConnectAttempt();
    first.reject(new Error("ECONNREFUSED"));
    await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());

    await vi.advanceTimersByTimeAsync(1_000);
    expect(subscribeToStoreChanges).toHaveBeenCalledTimes(2);
    second.resolve({ close: vi.fn() });
    await vi.waitFor(() => Promise.resolve());

    consoleErrorSpy.mockRestore();
  });
});

describe("stopInvoiceListener", () => {
  it("closes an active subscription and prevents reconnection", async () => {
    const attempt = mockNextConnectAttempt();
    startInvoiceListener();
    attempt.resolve({ close: attempt.closeSpy });
    await vi.waitFor(() => expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1));

    stopInvoiceListener();

    expect(attempt.closeSpy).toHaveBeenCalled();

    // A close event firing after stop() (e.g. the socket's own "close"
    // racing the explicit close() call above) must not trigger a reconnect.
    attempt.onClose();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending reconnect timer", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const first = mockNextConnectAttempt();
    startInvoiceListener();
    first.resolve({ close: vi.fn() });
    await vi.waitFor(() => expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1));

    first.onClose(new Error("dropped"));
    stopInvoiceListener();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(subscribeToStoreChanges).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });

  it("discards a subscription that resolves after stop() was already called mid-handshake", async () => {
    const attempt = mockNextConnectAttempt();
    startInvoiceListener();
    stopInvoiceListener();

    const closeSpy = vi.fn();
    attempt.resolve({ close: closeSpy });
    await vi.waitFor(() => expect(closeSpy).toHaveBeenCalled());
  });

  it("is a no-op if called when not running", () => {
    expect(() => stopInvoiceListener()).not.toThrow();
  });
});
