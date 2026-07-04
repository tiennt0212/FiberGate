import { beforeEach, describe, expect, it, vi } from "vitest";

// tryConsumeInvoiceCreationSlot() keeps its counter in module-level mutable
// state (invoiceCreationTimestamps), not reset between calls — per
// harness-brief.md "Reuse opportunities", every test case here resets the
// module registry and re-imports fresh so state never leaks across cases.
// `now` is passed explicitly throughout; no real timers/sleeps.

describe("tryConsumeInvoiceCreationSlot", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows a request when the window is empty", async () => {
    const { tryConsumeInvoiceCreationSlot } = await import("./rate-limit");
    expect(tryConsumeInvoiceCreationSlot(0)).toBe(true);
  });

  it("allows exactly 100 requests within the 60s window, then rejects the 101st", async () => {
    const { tryConsumeInvoiceCreationSlot } = await import("./rate-limit");
    const now = 1_000_000;

    for (let i = 0; i < 100; i += 1) {
      expect(tryConsumeInvoiceCreationSlot(now)).toBe(true);
    }
    expect(tryConsumeInvoiceCreationSlot(now)).toBe(false);
  });

  it("frees up a slot once the 60s window has fully slid past the earlier timestamps", async () => {
    const { tryConsumeInvoiceCreationSlot } = await import("./rate-limit");
    const now = 1_000_000;

    for (let i = 0; i < 100; i += 1) {
      tryConsumeInvoiceCreationSlot(now);
    }
    expect(tryConsumeInvoiceCreationSlot(now)).toBe(false);

    // Advance strictly past the 60s sliding window — all earlier timestamps
    // are pruned, freeing a slot again.
    expect(tryConsumeInvoiceCreationSlot(now + 60_000 + 1)).toBe(true);
  });

  it("does not leak the previous test's fully-consumed window (module reset)", async () => {
    const { tryConsumeInvoiceCreationSlot } = await import("./rate-limit");
    // If state leaked from the prior test (which filled the window to 100),
    // this would return false. A fresh module instance means an empty window.
    expect(tryConsumeInvoiceCreationSlot(0)).toBe(true);
  });
});
