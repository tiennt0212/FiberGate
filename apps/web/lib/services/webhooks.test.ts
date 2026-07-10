import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiValidationError } from "@/lib/api/validation";
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
  regenerateWebhookSecret,
  listWebhookDeliveries,
  getWebhookDeliveryHealth,
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

describe("regenerateWebhookSecret", () => {
  it("generates a fresh >=32-byte random secret, encrypts it, and updates the row", async () => {
    vi.mocked(encryptWebhookSecret).mockReturnValue("new-encrypted-value");
    const chain = createQueryChain([
      { id: "ep-1", url: "https://x.example", secret: "new-encrypted-value", events: ["payment.paid"], isActive: true },
    ]);
    vi.mocked(db.update).mockReturnValue(chain as unknown as ReturnType<typeof db.update>);

    const result = await regenerateWebhookSecret("ep-1");

    expect(result.secret).toMatch(/^[0-9a-f]{64,}$/);
    expect(encryptWebhookSecret).toHaveBeenCalledWith(result.secret);
    expect(chain.set).toHaveBeenCalledWith({ secret: "new-encrypted-value" });
    expect(result.endpoint.id).toBe("ep-1");
  });

  it("throws if no endpoint row matches the id", async () => {
    vi.mocked(encryptWebhookSecret).mockReturnValue("new-encrypted-value");
    vi.mocked(db.update).mockReturnValue(createQueryChain([]) as unknown as ReturnType<typeof db.update>);

    await expect(regenerateWebhookSecret("missing")).rejects.toThrow(/no webhook_endpoints row/);
  });
});

describe("listWebhookDeliveries", () => {
  it("returns rows ordered by created_at desc via the joined query", async () => {
    const chain = createQueryChain([
      { id: "d1", invoiceId: "inv-1", eventType: "payment.paid", endpointId: "ep-1", endpointUrl: "https://x.example", httpStatus: 200, status: "success", attemptCount: 1, deliveredAt: new Date(), createdAt: new Date() },
    ]);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const result = await listWebhookDeliveries({ limit: 20 });

    expect(chain.leftJoin).toHaveBeenCalled();
    expect(chain.orderBy).toHaveBeenCalled();
    expect(result.rows).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it("caps the query at limit + 1 and reports hasMore via a non-null cursor", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `d${i}`,
      invoiceId: "inv-1",
      eventType: "payment.paid",
      endpointId: "ep-1",
      endpointUrl: "https://x.example",
      httpStatus: 200,
      status: "success",
      attemptCount: 1,
      deliveredAt: new Date(),
      createdAt: new Date(2026, 6, 1, 12, i),
    }));
    const chain = createQueryChain(rows);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const result = await listWebhookDeliveries({ limit: 2 });

    expect(chain.limit).toHaveBeenCalledWith(3);
    expect(result.rows).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it("throws ApiValidationError for a malformed cursor, without querying the DB", async () => {
    vi.mocked(db.select).mockReturnValue(createQueryChain([]) as unknown as ReturnType<typeof db.select>);

    await expect(listWebhookDeliveries({ limit: 20, cursor: "not-base64-json" })).rejects.toBeInstanceOf(
      ApiValidationError,
    );
  });

  it("applies endpointId/status/search/date-range filters as extra WHERE conditions", async () => {
    const chain = createQueryChain([]);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    await listWebhookDeliveries({
      limit: 20,
      endpointId: "ep-1",
      status: "failed",
      search: "abc123",
      createdFrom: new Date("2026-06-01T00:00:00Z"),
      createdTo: new Date("2026-07-01T00:00:00Z"),
    });

    expect(chain.where).toHaveBeenCalled();
  });
});

describe("getWebhookDeliveryHealth", () => {
  it("computes success rate over resolved deliveries only, excluding pending", async () => {
    const chain = createQueryChain([
      { endpointId: "ep-1", endpointUrl: "https://good.example", status: "success" },
      { endpointId: "ep-1", endpointUrl: "https://good.example", status: "success" },
      { endpointId: "ep-1", endpointUrl: "https://good.example", status: "pending" },
      { endpointId: "ep-2", endpointUrl: "https://bad.example", status: "failed" },
    ]);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const health = await getWebhookDeliveryHealth();

    // 2 success + 1 failed = 3 resolved (the pending row excluded); 2/3 -> 67%.
    expect(health.resolvedCount).toBe(3);
    expect(health.successRatePct).toBe(67);
  });

  it("reports the endpoint with the highest failure rate as worstEndpoint", async () => {
    const chain = createQueryChain([
      { endpointId: "ep-1", endpointUrl: "https://mostly-fine.example", status: "success" },
      { endpointId: "ep-1", endpointUrl: "https://mostly-fine.example", status: "success" },
      { endpointId: "ep-1", endpointUrl: "https://mostly-fine.example", status: "failed" },
      { endpointId: "ep-2", endpointUrl: "https://always-fails.example", status: "failed" },
      { endpointId: "ep-2", endpointUrl: "https://always-fails.example", status: "failed" },
    ]);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const health = await getWebhookDeliveryHealth();

    expect(health.worstEndpoint).toEqual({ endpointId: "ep-2", endpointUrl: "https://always-fails.example", failurePct: 100 });
  });

  it("returns null successRatePct and worstEndpoint when there are no deliveries in-window", async () => {
    vi.mocked(db.select).mockReturnValue(createQueryChain([]) as unknown as ReturnType<typeof db.select>);

    await expect(getWebhookDeliveryHealth()).resolves.toEqual({
      successRatePct: null,
      resolvedCount: 0,
      worstEndpoint: null,
    });
  });

  it("does not flag an endpoint with 100% success as worstEndpoint", async () => {
    const chain = createQueryChain([{ endpointId: "ep-1", endpointUrl: "https://good.example", status: "success" }]);
    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>);

    const health = await getWebhookDeliveryHealth();

    expect(health.worstEndpoint).toBeNull();
  });
});
