import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WebhookDeliveryRow, WebhookEndpointRow } from "@/lib/db/schema";
import { createQueryChain } from "@/lib/db/test-fixtures";

import { buildWebhookDeliveryRow, buildWebhookEndpointRow } from "./test-fixtures";

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
    mockDeliveryAndEndpointLookup(buildWebhookDeliveryRow({ attemptCount: 0 }), buildWebhookEndpointRow());
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
    const delivery = buildWebhookDeliveryRow({ payload: { event: "payment.paid", data: { invoice_id: "inv-1" } } });
    mockDeliveryAndEndpointLookup(delivery, buildWebhookEndpointRow());
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
    mockDeliveryAndEndpointLookup(buildWebhookDeliveryRow({ attemptCount: 0 }), buildWebhookEndpointRow());
    vi.mocked(fetch).mockResolvedValue(new Response("server error", { status: 500 }));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", attemptCount: 1 }));
    expect(scheduleAttempt).toHaveBeenCalledWith("delivery-1", 60_000);
  });

  it("schedules attempt 3 at +300s on a retryable HTTP 429 (attempt 2)", async () => {
    mockDeliveryAndEndpointLookup(buildWebhookDeliveryRow({ attemptCount: 1 }), buildWebhookEndpointRow());
    vi.mocked(fetch).mockResolvedValue(new Response("too many requests", { status: 429 }));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", attemptCount: 2 }));
    expect(scheduleAttempt).toHaveBeenCalledWith("delivery-1", 300_000);
  });

  it("marks status=failed with no further retry once the 3-attempt cap is reached (BR-WHK-003)", async () => {
    mockDeliveryAndEndpointLookup(buildWebhookDeliveryRow({ attemptCount: 2 }), buildWebhookEndpointRow());
    vi.mocked(fetch).mockResolvedValue(new Response("server error", { status: 503 }));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", attemptCount: 3 }));
    expect(scheduleAttempt).not.toHaveBeenCalled();
  });

  it("marks status=failed immediately (no retry) on a non-retryable 4xx, even on attempt 1", async () => {
    mockDeliveryAndEndpointLookup(buildWebhookDeliveryRow({ attemptCount: 0 }), buildWebhookEndpointRow());
    vi.mocked(fetch).mockResolvedValue(new Response("bad request", { status: 400 }));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "failed", attemptCount: 1 }));
    expect(scheduleAttempt).not.toHaveBeenCalled();
  });

  it("treats a request timeout/abort as retryable with no http_status", async () => {
    mockDeliveryAndEndpointLookup(buildWebhookDeliveryRow({ attemptCount: 0 }), buildWebhookEndpointRow());
    vi.mocked(fetch).mockRejectedValue(new DOMException("The operation was aborted", "AbortError"));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", httpStatus: null, attemptCount: 1 }),
    );
    expect(scheduleAttempt).toHaveBeenCalledWith("delivery-1", 60_000);
  });

  it("treats a network-level failure as retryable", async () => {
    mockDeliveryAndEndpointLookup(buildWebhookDeliveryRow({ attemptCount: 0 }), buildWebhookEndpointRow());
    vi.mocked(fetch).mockRejectedValue(new Error("connect ECONNREFUSED"));

    await attemptDelivery("delivery-1");

    expect(updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
    expect(scheduleAttempt).toHaveBeenCalledWith("delivery-1", 60_000);
  });

  it("truncates a response body over 1KB without splitting a multi-byte UTF-8 character", async () => {
    mockDeliveryAndEndpointLookup(buildWebhookDeliveryRow({ attemptCount: 0 }), buildWebhookEndpointRow());
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
    mockDeliveryAndEndpointLookup(buildWebhookDeliveryRow(), undefined);

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
    mockDeliveryAndEndpointLookup(buildWebhookDeliveryRow(), buildWebhookEndpointRow());
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
