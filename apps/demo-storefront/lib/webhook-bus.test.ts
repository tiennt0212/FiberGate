import { describe, expect, it, vi } from "vitest";

import { publish, subscribe } from "./webhook-bus";

describe("webhook-bus", () => {
  it("delivers a published event to a subscribed listener for the same invoice id", () => {
    const listener = vi.fn();
    subscribe("inv-1", listener);

    publish({ invoiceId: "inv-1", status: "paid" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ invoiceId: "inv-1", status: "paid" });
  });

  it("does not deliver events published for a different invoice id", () => {
    const listener = vi.fn();
    subscribe("inv-1", listener);

    publish({ invoiceId: "inv-2", status: "paid" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("supports multiple listeners on the same invoice id", () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    subscribe("inv-1", listenerA);
    subscribe("inv-1", listenerB);

    publish({ invoiceId: "inv-1", status: "expired" });

    expect(listenerA).toHaveBeenCalledOnce();
    expect(listenerB).toHaveBeenCalledOnce();
  });

  it("stops delivering to a listener after it unsubscribes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe("inv-1", listener);
    unsubscribe();

    publish({ invoiceId: "inv-1", status: "paid" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("publishing with no subscribers is a no-op, not a throw", () => {
    expect(() => publish({ invoiceId: "no-such-invoice", status: "paid" })).not.toThrow();
  });
});
