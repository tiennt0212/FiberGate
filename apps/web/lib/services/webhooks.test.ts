import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryChain } from "@/lib/db/test-fixtures";
import { buildWebhookDeliveryRow } from "@/lib/webhooks/test-fixtures";

// Mock at the module boundary: @/lib/db, @/lib/webhooks/secret-crypto
// (pure crypto, covered by its own secret-crypto.test.ts), and
// @/lib/webhooks/retry-scheduler (arming real timers has no place in a
// service-layer CRUD test).
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/lib/webhooks/secret-crypto", () => ({
  encryptWebhookSecret: vi.fn(),
}));
vi.mock("@/lib/webhooks/retry-scheduler", () => ({
  scheduleAttempt: vi.fn(),
  cancelScheduledAttempt: vi.fn(),
}));

const { db } = await import("@/lib/db");
const { encryptWebhookSecret } = await import("@/lib/webhooks/secret-crypto");
const { scheduleAttempt, cancelScheduledAttempt } = await import("@/lib/webhooks/retry-scheduler");
const {
  createWebhookEndpoint,
  listWebhookEndpoints,
  updateWebhookEndpoint,
  deactivateWebhookEndpoint,
  resendDelivery,
} = await import("./webhooks");

afterEach(() => {
  vi.clearAllMocks();
});

describe("createWebhookEndpoint", () => {
  it("generates a >=32-byte random secret, encrypts it, and inserts the encrypted form", async () => {
    vi.mocked(encryptWebhookSecret).mockReturnValue("encrypted-value");
    const insertChain = createQueryChain([
      { id: "ep-1", url: "https://x.example", secret: "encrypted-value", events: ["payment.paid"], isActive: true, createdAt: new Date() },
    ]);
    vi.mocked(db.insert).mockReturnValue(insertChain as unknown as ReturnType<typeof db.insert>);

    const result = await createWebhookEndpoint({ url: "https://x.example", events: ["payment.paid"] });

    // BR-SEC-003: random, >= 32 bytes. Generated as hex, so >= 64 chars.
    expect(result.secret).toMatch(/^[0-9a-f]{64,}$/);
    expect(encryptWebhookSecret).toHaveBeenCalledWith(result.secret);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://x.example", secret: "encrypted-value", isActive: true }),
    );
    expect(result.endpoint.id).toBe("ep-1");
  });

  it("generates a different secret on each call", async () => {
    vi.mocked(encryptWebhookSecret).mockReturnValue("encrypted-value");
    vi.mocked(db.insert).mockReturnValue(
      createQueryChain([{ id: "ep-1" }]) as unknown as ReturnType<typeof db.insert>,
    );

    const first = await createWebhookEndpoint({ url: "https://x.example", events: ["payment.paid"] });
    const second = await createWebhookEndpoint({ url: "https://x.example", events: ["payment.paid"] });

    expect(first.secret).not.toBe(second.secret);
  });

  it("throws if the insert returns no row", async () => {
    vi.mocked(encryptWebhookSecret).mockReturnValue("encrypted-value");
    vi.mocked(db.insert).mockReturnValue(createQueryChain([]) as unknown as ReturnType<typeof db.insert>);

    await expect(createWebhookEndpoint({ url: "https://x.example", events: ["payment.paid"] })).rejects.toThrow(
      "Webhook endpoint insert returned no row",
    );
  });
});

describe("listWebhookEndpoints", () => {
  it("returns rows ordered by created_at desc", async () => {
    const chain = createQueryChain([{ id: "ep-1" }, { id: "ep-2" }]);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const rows = await listWebhookEndpoints();

    expect(chain.orderBy).toHaveBeenCalled();
    expect(rows).toEqual([{ id: "ep-1" }, { id: "ep-2" }]);
  });
});

describe("updateWebhookEndpoint", () => {
  it("only sets the fields provided", async () => {
    const chain = createQueryChain([{ id: "ep-1", url: "https://new.example" }]);
    vi.mocked(db.update).mockReturnValue(chain as unknown as ReturnType<typeof db.update>);

    await updateWebhookEndpoint("ep-1", { url: "https://new.example" });

    expect(chain.set).toHaveBeenCalledWith({ url: "https://new.example" });
  });

  it("returns null if no row matches", async () => {
    vi.mocked(db.update).mockReturnValue(createQueryChain([]) as unknown as ReturnType<typeof db.update>);

    const result = await updateWebhookEndpoint("missing", { isActive: false });

    expect(result).toBeNull();
  });
});

describe("deactivateWebhookEndpoint", () => {
  it("sets is_active to false", async () => {
    const chain = createQueryChain([{ id: "ep-1", isActive: false }]);
    vi.mocked(db.update).mockReturnValue(chain as unknown as ReturnType<typeof db.update>);

    const result = await deactivateWebhookEndpoint("ep-1");

    expect(chain.set).toHaveBeenCalledWith({ isActive: false });
    expect(result).toEqual({ id: "ep-1", isActive: false });
  });
});

describe("resendDelivery", () => {
  const ORIGINAL = buildWebhookDeliveryRow({ id: "delivery-original", status: "failed", attemptCount: 3 });

  function mockOriginalDelivery() {
    vi.mocked(db.select).mockReturnValue(createQueryChain([ORIGINAL]) as unknown as ReturnType<typeof db.select>);
  }

  function mockNewDeliveryInsert() {
    const insertChain = createQueryChain([{ id: "delivery-new" }]);
    vi.mocked(db.insert).mockReturnValue(insertChain as unknown as ReturnType<typeof db.insert>);
    return insertChain;
  }

  it("creates a brand-new row reusing the original payload byte-for-byte, with a fresh attempt cycle", async () => {
    mockOriginalDelivery();
    const insertChain = mockNewDeliveryInsert();

    await resendDelivery("delivery-original");

    expect(insertChain.values).toHaveBeenCalledWith({
      endpointId: "endpoint-1",
      invoiceId: "inv-1",
      eventType: "payment.paid",
      payload: ORIGINAL.payload,
      attemptCount: 0,
      status: "pending",
    });
  });

  it("cancels any armed timer for the original delivery id before dispatching the resend", async () => {
    mockOriginalDelivery();
    mockNewDeliveryInsert();

    await resendDelivery("delivery-original");

    expect(cancelScheduledAttempt).toHaveBeenCalledWith("delivery-original");
  });

  it("arms an immediate (delay 0) attempt for the newly-created row, without awaiting delivery", async () => {
    mockOriginalDelivery();
    mockNewDeliveryInsert();

    const resent = await resendDelivery("delivery-original");

    expect(scheduleAttempt).toHaveBeenCalledWith("delivery-new", 0);
    expect(resent).toEqual({ id: "delivery-new" });
  });

  it("throws if the original delivery does not exist", async () => {
    vi.mocked(db.select).mockReturnValue(createQueryChain([]) as unknown as ReturnType<typeof db.select>);

    await expect(resendDelivery("missing")).rejects.toThrow(/no webhook_deliveries row/);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("throws if the insert returns no row", async () => {
    mockOriginalDelivery();
    vi.mocked(db.insert).mockReturnValue(createQueryChain([]) as unknown as ReturnType<typeof db.insert>);

    await expect(resendDelivery("delivery-original")).rejects.toThrow(
      "Webhook delivery resend insert returned no row",
    );
  });
});
