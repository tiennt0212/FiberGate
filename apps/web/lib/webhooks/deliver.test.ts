import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WebhookDeliveryRow, WebhookEndpointRow } from "@/lib/services/webhooks";

// Mock at the module boundary: @/lib/db, decryptWebhookSecret/
// signWebhookPayload (pure crypto helpers, not worth exercising for real
// here), and the retry-scheduler's scheduleAttempt() (deliver.ts and
// retry-scheduler.ts import each other — mocking retry-scheduler keeps this
// a unit test of deliver.ts alone). `fetch` is stubbed globally.
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("./secret-crypto", () => ({
  decryptWebhookSecret: vi.fn(),
}));
vi.mock("./sign", () => ({
  signWebhookPayload: vi.fn(),
}));
vi.mock("./retry-scheduler", () => ({
  scheduleAttempt: vi.fn(),
}));

const { db } = await import("@/lib/db");
const { decryptWebhookSecret } = await import("./secret-crypto");
const { signWebhookPayload } = await import("./sign");
const { scheduleAttempt } = await import("./retry-scheduler");
const { attemptDelivery } = await import("./deliver");

function createQueryChain<T>(rows: T[]) {
  const chain = Promise.resolve(rows) as Promise<T[]> & {
    from: (...args: unknown[]) => typeof chain;
    where: (...args: unknown[]) => typeof chain;
    limit: (...args: unknown[]) => typeof chain;
    set: (...args: unknown[]) => typeof chain;
  };
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.set = vi.fn(() => chain);
  return chain;
}

function buildDeliveryRow(overrides: Partial<WebhookDeliveryRow> = {}): WebhookDeliveryRow {
  return {
    id: "delivery-1",
    endpointId: "endpoint-1",
    invoiceId: "inv-1",
    eventType: "payment.paid",
    payload: { event: "payment.paid", created_at: "2026-07-01T11:05:00.000Z", data: { invoice_id: "inv-1" } },
    httpStatus: null,
    responseBody: null,
    attemptCount: 0,
    status: "pending",
    nextRetryAt: null,
    deliveredAt: null,
    createdAt: new Date("2026-07-01T11:05:00Z"),
    ...overrides,
  };
}

function buildEndpointRow(overrides: Partial<WebhookEndpointRow> = {}): WebhookEndpointRow {
  return {
    id: "endpoint-1",
    url: "https://merchant.example.com/webhooks",
    secret: "encrypted-secret-value",
    events: ["payment.paid"],
    isActive: true,
    createdAt: new Date("2026-07-01T10:00:00Z"),
    ...overrides,
  };
}

function mockDeliveryAndEndpointLookup(delivery: WebhookDeliveryRow | undefined, endpoint?: WebhookEndpointRow) {
  const deliveryChain = createQueryChain(delivery ? [delivery] : []);
  const mockedSelect = vi.mocked(db.select);
  mockedSelect.mockReturnValueOnce(deliveryChain as unknown as ReturnType<typeof db.select>);
  if (delivery?.endpointId) {
    const endpointChain = createQueryChain(endpoint ? [endpoint] : []);
    mockedSelect.mockReturnValueOnce(endpointChain as unknown as ReturnType<typeof db.select>);
  }
}

let updateChain: ReturnType<typeof createQueryChain<unknown>>;

beforeEach(() => {
  updateChain = createQueryChain([]);
  vi.mocked(db.update).mockReturnValue(updateChain as unknown as ReturnType<typeof db.update>);
  vi.mocked(decryptWebhookSecret).mockReturnValue("decrypted-secret");
  vi.mocked(signWebhookPayload).mockReturnValue("sha256=deadbeef");
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("attemptDelivery", () => {
  it("persists a successful delivery as status=success with delivered_at set, and does not schedule a retry", async () => {
    mockDeliveryAndEndpointLookup(buildDeliveryRow({ attemptCount: 0 }), buildEndpointRow());
    vi.mocked(fetch).mockResolvedValue(new Response("ok", { status: 200 }));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", httpStatus: 200, attemptCount: 1 }),
    );
    const setArg = vi.mocked(updateChain.set).mock.calls[0]?.[0] as { deliveredAt?: Date };
    expect(setArg.deliveredAt).toBeInstanceOf(Date);
    expect(scheduleAttempt).not.toHaveBeenCalled();
  });

  it("signs the exact stored payload bytes and posts them with the X-Fiber-Signature header", async () => {
    const delivery = buildDeliveryRow({ payload: { event: "payment.paid", data: { invoice_id: "inv-1" } } });
    mockDeliveryAndEndpointLookup(delivery, buildEndpointRow());
    vi.mocked(fetch).mockResolvedValue(new Response("ok", { status: 200 }));

    await attemptDelivery("delivery-1");

    const expectedRawBody = JSON.stringify(delivery.payload);
    expect(signWebhookPayload).toHaveBeenCalledWith(expectedRawBody, "decrypted-secret");
    expect(fetch).toHaveBeenCalledWith(
      "https://merchant.example.com/webhooks",
      expect.objectContaining({
        method: "POST",
        body: expectedRawBody,
        headers: expect.objectContaining({ "X-Fiber-Signature": "sha256=deadbeef" }),
      }),
    );
  });

  it("schedules attempt 2 at +60s on a retryable HTTP 500 (attempt 1)", async () => {
    mockDeliveryAndEndpointLookup(buildDeliveryRow({ attemptCount: 0 }), buildEndpointRow());
    vi.mocked(fetch).mockResolvedValue(new Response("server error", { status: 500 }));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", attemptCount: 1 }));
    expect(scheduleAttempt).toHaveBeenCalledWith("delivery-1", 60_000);
  });

  it("schedules attempt 3 at +300s on a retryable HTTP 429 (attempt 2)", async () => {
    mockDeliveryAndEndpointLookup(buildDeliveryRow({ attemptCount: 1 }), buildEndpointRow());
    vi.mocked(fetch).mockResolvedValue(new Response("too many requests", { status: 429 }));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", attemptCount: 2 }));
    expect(scheduleAttempt).toHaveBeenCalledWith("delivery-1", 300_000);
  });

  it("marks status=failed with no further retry once the 3-attempt cap is reached (BR-WHK-003)", async () => {
    mockDeliveryAndEndpointLookup(buildDeliveryRow({ attemptCount: 2 }), buildEndpointRow());
    vi.mocked(fetch).mockResolvedValue(new Response("server error", { status: 503 }));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", attemptCount: 3 }));
    expect(scheduleAttempt).not.toHaveBeenCalled();
  });

  it("marks status=failed immediately (no retry) on a non-retryable 4xx, even on attempt 1", async () => {
    mockDeliveryAndEndpointLookup(buildDeliveryRow({ attemptCount: 0 }), buildEndpointRow());
    vi.mocked(fetch).mockResolvedValue(new Response("bad request", { status: 400 }));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", attemptCount: 1 }));
    expect(scheduleAttempt).not.toHaveBeenCalled();
  });

  it("treats a request timeout/abort as retryable with no http_status", async () => {
    mockDeliveryAndEndpointLookup(buildDeliveryRow({ attemptCount: 0 }), buildEndpointRow());
    vi.mocked(fetch).mockRejectedValue(new DOMException("The operation was aborted", "AbortError"));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", httpStatus: null, attemptCount: 1 }),
    );
    expect(scheduleAttempt).toHaveBeenCalledWith("delivery-1", 60_000);
  });

  it("treats a network-level failure as retryable", async () => {
    mockDeliveryAndEndpointLookup(buildDeliveryRow({ attemptCount: 0 }), buildEndpointRow());
    vi.mocked(fetch).mockRejectedValue(new Error("connect ECONNREFUSED"));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
    expect(scheduleAttempt).toHaveBeenCalledWith("delivery-1", 60_000);
  });

  it("truncates a response body over 1KB without splitting a multi-byte UTF-8 character", async () => {
    mockDeliveryAndEndpointLookup(buildDeliveryRow({ attemptCount: 0 }), buildEndpointRow());
    // 1022 ascii bytes + a 4-byte emoji = 1026 bytes total; a naive
    // byte-1024 cut would land 2 bytes into the emoji's 4-byte sequence.
    const oversizedBody = "a".repeat(1022) + "😀";
    vi.mocked(fetch).mockResolvedValue(new Response(oversizedBody, { status: 200 }));

    await attemptDelivery("delivery-1");

    const setArg = vi.mocked(updateChain.set).mock.calls[0]?.[0] as { responseBody: string };
    expect(Buffer.byteLength(setArg.responseBody, "utf8")).toBeLessThanOrEqual(1024);
    // The safe truncation must drop the incomplete emoji entirely rather
    // than emit a corrupted/replacement character.
    expect(setArg.responseBody).toBe("a".repeat(1022));
  });

  it("logs and marks the delivery failed if no webhook_endpoints row exists for it", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockDeliveryAndEndpointLookup(buildDeliveryRow(), undefined);

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith({ status: "failed" });
    expect(fetch).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("logs and returns without throwing if no webhook_deliveries row exists for the id", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockDeliveryAndEndpointLookup(undefined);

    await expect(attemptDelivery("missing-id")).resolves.toBeUndefined();

    expect(db.update).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("marks the delivery failed if decrypting the endpoint secret throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockDeliveryAndEndpointLookup(buildDeliveryRow(), buildEndpointRow());
    vi.mocked(decryptWebhookSecret).mockImplementation(() => {
      throw new Error("bad ciphertext");
    });

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith({ status: "failed" });
    expect(fetch).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
