import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./invoice-poller", () => ({
  runPollCycle: vi.fn(),
}));

const { runPollCycle } = await import("./invoice-poller");
const { startInvoicePoller, stopInvoicePoller } = await import("./worker");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  stopInvoicePoller();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("startInvoicePoller", () => {
  it("runs a poll cycle every 10s", async () => {
    vi.mocked(runPollCycle).mockResolvedValue(undefined);
    startInvoicePoller();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(runPollCycle).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(runPollCycle).toHaveBeenCalledTimes(2);
  });

  it("is a no-op if called again while already running", async () => {
    vi.mocked(runPollCycle).mockResolvedValue(undefined);
    startInvoicePoller();
    startInvoicePoller();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(runPollCycle).toHaveBeenCalledTimes(1);
  });

  it("skips a tick if the previous cycle is still in flight", async () => {
    const resolvers: Array<() => void> = [];
    vi.mocked(runPollCycle).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    startInvoicePoller();

    await vi.advanceTimersByTimeAsync(10_000); // cycle 1 starts, never resolves yet
    await vi.advanceTimersByTimeAsync(10_000); // tick 2 fires while cycle 1 still in flight
    expect(runPollCycle).toHaveBeenCalledTimes(1); // re-entrancy guard held tick 2 back

    resolvers[0]?.();
    await Promise.resolve(); // flush cycle 1's .catch/.finally microtasks
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(runPollCycle).toHaveBeenCalledTimes(2); // free to run again once cycle 1 finished

    resolvers[1]?.(); // don't leave a dangling pending promise behind for the next test
  });

  it("logs and continues if a poll cycle rejects", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(runPollCycle).mockRejectedValueOnce(new Error("db down"));

    startInvoicePoller();
    await vi.advanceTimersByTimeAsync(10_000);
    // vi.waitFor polls with real timers under the hood, so it reliably
    // flushes the rejection's .catch/.finally microtask chain regardless of
    // how many hops it takes — unlike guessing a fixed number of
    // Promise.resolve() flushes.
    await vi.waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());

    consoleErrorSpy.mockRestore();
  });
});

describe("stopInvoicePoller", () => {
  it("clears the interval so no further cycles run", async () => {
    vi.mocked(runPollCycle).mockResolvedValue(undefined);
    startInvoicePoller();
    stopInvoicePoller();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(runPollCycle).not.toHaveBeenCalled();
  });

  it("is a no-op if called when not running", () => {
    expect(() => stopInvoicePoller()).not.toThrow();
  });
});
