import { afterEach, describe, expect, it, vi } from "vitest";

import { buildWebhookEndpointRow } from "@/lib/webhooks/test-fixtures";

// Mock at the service-layer boundary (CLAUDE.md's route.test.ts pattern —
// actions.ts plays the same "thin controller" role as route.ts, just for
// Server Actions instead of REST routes), not @/lib/db directly.
vi.mock("@/lib/services/webhooks", () => ({
  createWebhookEndpoint: vi.fn(),
  updateWebhookEndpoint: vi.fn(),
  deactivateWebhookEndpoint: vi.fn(),
  regenerateWebhookSecret: vi.fn(),
  listWebhookDeliveries: vi.fn(),
}));

const { createWebhookEndpoint, updateWebhookEndpoint, deactivateWebhookEndpoint, regenerateWebhookSecret, listWebhookDeliveries } =
  await import("@/lib/services/webhooks");
const { createEndpoint, toggleEndpointActive, regenerateSecret, getEndpointDeliveries } = await import("./actions");

afterEach(() => {
  vi.clearAllMocks();
});

describe("createEndpoint", () => {
  it("rejects a non-https URL without calling the service", async () => {
    const result = await createEndpoint("http://merchant.example.com/webhooks", ["payment.paid"]);

    expect(result).toEqual({ ok: false, error: "URL must start with https://" });
    expect(createWebhookEndpoint).not.toHaveBeenCalled();
  });

  it("rejects a malformed https URL without calling the service", async () => {
    const result = await createEndpoint("https://", ["payment.paid"]);

    expect(result).toEqual({ ok: false, error: "Invalid URL format" });
    expect(createWebhookEndpoint).not.toHaveBeenCalled();
  });

  it("rejects when no valid event is selected", async () => {
    const result = await createEndpoint("https://merchant.example.com/webhooks", []);

    expect(result).toEqual({ ok: false, error: "Select at least one event" });
    expect(createWebhookEndpoint).not.toHaveBeenCalled();
  });

  it("rejects when every provided event string is unrecognized", async () => {
    const result = await createEndpoint("https://merchant.example.com/webhooks", ["channel.opened"]);

    expect(result).toEqual({ ok: false, error: "Select at least one event" });
    expect(createWebhookEndpoint).not.toHaveBeenCalled();
  });

  it("filters out unrecognized events but keeps the valid ones", async () => {
    vi.mocked(createWebhookEndpoint).mockResolvedValue({ endpoint: buildWebhookEndpointRow(), secret: "plaintext-secret" });

    await createEndpoint("https://merchant.example.com/webhooks", ["payment.paid", "channel.opened", "invoice.expired"]);

    expect(createWebhookEndpoint).toHaveBeenCalledWith({
      url: "https://merchant.example.com/webhooks",
      events: ["payment.paid", "invoice.expired"],
    });
  });

  it("returns the endpoint view and the one-time plaintext secret on success", async () => {
    const row = buildWebhookEndpointRow({ id: "endpoint-9", url: "https://merchant.example.com/webhooks" });
    vi.mocked(createWebhookEndpoint).mockResolvedValue({ endpoint: row, secret: "plaintext-secret" });

    const result = await createEndpoint("https://merchant.example.com/webhooks", ["payment.paid"]);

    expect(result.ok).toBe(true);
    expect(result.secret).toBe("plaintext-secret");
    expect(result.endpoint).toEqual(
      expect.objectContaining({ id: "endpoint-9", url: "https://merchant.example.com/webhooks" }),
    );
  });

  it("returns a generic ok:false error instead of throwing when the service fails", async () => {
    vi.mocked(createWebhookEndpoint).mockRejectedValue(new Error("db unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createEndpoint("https://merchant.example.com/webhooks", ["payment.paid"]);

    expect(result).toEqual({ ok: false, error: "Could not create the endpoint." });
    consoleError.mockRestore();
  });
});

describe("toggleEndpointActive", () => {
  it("re-enables via updateWebhookEndpoint, not deactivateWebhookEndpoint, when nextActive is true", async () => {
    vi.mocked(updateWebhookEndpoint).mockResolvedValue(buildWebhookEndpointRow({ isActive: true }));

    const result = await toggleEndpointActive("endpoint-1", true);

    expect(result).toEqual({ ok: true });
    expect(updateWebhookEndpoint).toHaveBeenCalledWith("endpoint-1", { isActive: true });
    expect(deactivateWebhookEndpoint).not.toHaveBeenCalled();
  });

  it("disables via the dedicated deactivateWebhookEndpoint (never a raw patch), when nextActive is false", async () => {
    vi.mocked(deactivateWebhookEndpoint).mockResolvedValue(buildWebhookEndpointRow({ isActive: false }));

    const result = await toggleEndpointActive("endpoint-1", false);

    expect(result).toEqual({ ok: true });
    expect(deactivateWebhookEndpoint).toHaveBeenCalledWith("endpoint-1");
    expect(updateWebhookEndpoint).not.toHaveBeenCalled();
  });

  it("reports 'Endpoint not found.' instead of a generic error when the row doesn't exist", async () => {
    vi.mocked(deactivateWebhookEndpoint).mockResolvedValue(null);

    const result = await toggleEndpointActive("missing-id", false);

    expect(result).toEqual({ ok: false, error: "Endpoint not found." });
  });

  it("returns a generic ok:false error instead of throwing when the service fails", async () => {
    vi.mocked(updateWebhookEndpoint).mockRejectedValue(new Error("db unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await toggleEndpointActive("endpoint-1", true);

    expect(result).toEqual({ ok: false, error: "Could not update the endpoint." });
    consoleError.mockRestore();
  });
});

describe("regenerateSecret", () => {
  it("returns the new one-time plaintext secret on success", async () => {
    vi.mocked(regenerateWebhookSecret).mockResolvedValue({ endpoint: buildWebhookEndpointRow(), secret: "new-plaintext-secret" });

    const result = await regenerateSecret("endpoint-1");

    expect(result).toEqual({ ok: true, secret: "new-plaintext-secret" });
    expect(regenerateWebhookSecret).toHaveBeenCalledWith("endpoint-1");
  });

  it("returns a generic ok:false error instead of throwing when the service fails", async () => {
    vi.mocked(regenerateWebhookSecret).mockRejectedValue(new Error("endpoint not found"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await regenerateSecret("endpoint-1");

    expect(result).toEqual({ ok: false, error: "Could not regenerate the secret." });
    consoleError.mockRestore();
  });
});

describe("getEndpointDeliveries", () => {
  it("queries by endpointId with a limit of 10 and maps rows through toDeliveryView", async () => {
    vi.mocked(listWebhookDeliveries).mockResolvedValue({
      rows: [
        {
          id: "dl-1",
          invoiceId: "inv-1",
          eventType: "payment.paid",
          endpointId: "endpoint-1",
          endpointUrl: "https://merchant.example.com/webhooks",
          httpStatus: 200,
          status: "success",
          attemptCount: 1,
          deliveredAt: new Date("2026-07-01T11:06:00.000Z"),
          createdAt: new Date("2026-07-01T11:05:00.000Z"),
        },
      ],
      nextCursor: null,
    });

    const deliveries = await getEndpointDeliveries("endpoint-1");

    expect(listWebhookDeliveries).toHaveBeenCalledWith({ endpointId: "endpoint-1", limit: 10 });
    expect(deliveries).toEqual([
      {
        id: "dl-1",
        eventType: "payment.paid",
        endpointUrl: "https://merchant.example.com/webhooks",
        httpStatus: 200,
        status: "success",
        deliveredAt: "2026-07-01T11:06:00.000Z",
        createdAt: "2026-07-01T11:05:00.000Z",
      },
    ]);
  });
});
