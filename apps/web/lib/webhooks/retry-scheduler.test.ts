import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WebhookDeliveryRow } from "@/lib/services/webhooks";

// Mock at the module boundary: @/lib/db (for recoverPendingDeliveries()'s
// scan) and ./deliver (deliver.ts and retry-scheduler.ts import each other —
// mocking deliver.ts's attemptDelivery keeps this a unit test of the
// scheduler itself, not the delivery attempt logic covered by deliver.test.ts).
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));
vi.mock("./deliver", () => ({
  attemptDelivery: vi.fn(),
}));

const { db } = await import("@/lib/db");
const { attemptDelivery } = await import("./deliver");
const { scheduleAttempt, cancelScheduledAttempt, recoverPendingDeliveries } = await import("./retry-scheduler");

function createQueryChain<T>(rows: T[]) {
  const chain = Promise.resolve(rows) as Promise<T[]> & {
    from: (...args: unknown[]) => typeof chain;
    where: (...args: unknown[]) => typeof chain;
  };
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  return chain;
}

function buildDeliveryRow(overrides: Partial<WebhookDeliveryRow> = {}): WebhookDeliveryRow {
  return {
    id: "delivery-1",
    endpointId: "endpoint-1",
    invoiceId: "inv-1",
    eventType: "payment.paid",
    payload: {},
    httpStatus: null,
    responseBody: null,
    attemptCount: 1,
    status: "pending",
    nextRetryAt: new Date("2026-07-01T12:01:00Z"),
    deliveredAt: null,
    createdAt: new Date("2026-07-01T11:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-01T12:00:00Z"));
  vi.mocked(attemptDelivery).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("scheduleAttempt", () => {
  it("calls attemptDelivery once delayMs elapses", async () => {
    scheduleAttempt("delivery-1", 1000);

    await vi.advanceTimersByTimeAsync(1000);

    expect(attemptDelivery).toHaveBeenCalledWith("delivery-1");
  });

  it("does not call attemptDelivery before delayMs elapses", async () => {
    scheduleAttempt("delivery-1", 5000);

    await vi.advanceTimersByTimeAsync(4999);

    expect(attemptDelivery).not.toHaveBeenCalled();
  });

  it("re-scheduling the same delivery id cancels the previous timer instead of double-firing", async () => {
    scheduleAttempt("delivery-1", 1000);
    scheduleAttempt("delivery-1", 2000); // replaces the first timer

    await vi.advanceTimersByTimeAsync(1000);
    expect(attemptDelivery).not.toHaveBeenCalled(); // the original 1000ms timer never fires

    await vi.advanceTimersByTimeAsync(1000); // total 2000ms since the second call
    expect(attemptDelivery).toHaveBeenCalledTimes(1);
  });

  it("logs and does not throw if attemptDelivery rejects", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(attemptDelivery).mockRejectedValueOnce(new Error("db down"));

    scheduleAttempt("delivery-1", 100);
    await vi.advanceTimersByTimeAsync(100);
    await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());

    consoleErrorSpy.mockRestore();
  });
});

describe("cancelScheduledAttempt", () => {
  it("prevents a previously-armed timer from firing", async () => {
    scheduleAttempt("delivery-1", 1000);
    cancelScheduledAttempt("delivery-1");

    await vi.advanceTimersByTimeAsync(5000);

    expect(attemptDelivery).not.toHaveBeenCalled();
  });

  it("is a no-op if there is no armed timer for the id", () => {
    expect(() => cancelScheduledAttempt("no-such-delivery")).not.toThrow();
  });
});

describe("recoverPendingDeliveries", () => {
  it("re-arms a timer for each pending delivery, delayed by next_retry_at minus now", async () => {
    const row = buildDeliveryRow({ id: "delivery-future", nextRetryAt: new Date("2026-07-01T12:02:00Z") });
    vi.mocked(db.select).mockReturnValue(createQueryChain([row]) as unknown as ReturnType<typeof db.select>);

    await recoverPendingDeliveries(new Date("2026-07-01T12:00:00Z"));

    await vi.advanceTimersByTimeAsync(119_999);
    expect(attemptDelivery).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(attemptDelivery).toHaveBeenCalledWith("delivery-future");
  });

  it("clamps an already-overdue next_retry_at to a 0ms delay instead of a negative one", async () => {
    const row = buildDeliveryRow({ id: "delivery-overdue", nextRetryAt: new Date("2026-07-01T11:00:00Z") });
    vi.mocked(db.select).mockReturnValue(createQueryChain([row]) as unknown as ReturnType<typeof db.select>);

    await recoverPendingDeliveries(new Date("2026-07-01T12:00:00Z"));

    await vi.advanceTimersByTimeAsync(0);
    expect(attemptDelivery).toHaveBeenCalledWith("delivery-overdue");
  });

  it("schedules nothing when there are no pending deliveries with a next_retry_at", async () => {
    vi.mocked(db.select).mockReturnValue(createQueryChain([]) as unknown as ReturnType<typeof db.select>);

    await recoverPendingDeliveries();

    await vi.advanceTimersByTimeAsync(600_000);
    expect(attemptDelivery).not.toHaveBeenCalled();
  });
});
