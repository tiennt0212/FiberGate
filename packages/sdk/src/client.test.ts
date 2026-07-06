import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FiberGate, FiberGateApiError } from "./client";
import type { Invoice } from "./types";
import { InvoiceAsset, InvoiceStatus } from "./types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv_1",
    invoice_address: "fibt1...",
    payment_hash: "abc123",
    amount: 100,
    asset: InvoiceAsset.CKB,
    status: InvoiceStatus.Pending,
    expires_at: "2026-07-06T15:00:00Z",
    created_at: "2026-07-06T14:00:00Z",
    ...overrides,
  };
}

describe("FiberGate client", () => {
  const baseUrl = "http://localhost:3000/api/v1";
  const internalSecret = "test-internal-secret";
  let gateway: FiberGate;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    gateway = new FiberGate({ baseUrl, internalSecret });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("invoices.create", () => {
    const invoice = makeInvoice();

    it("POSTs to /invoices with the Bearer token and JSON body, returns the created invoice", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: invoice, error: null }, 201));

      const result = await gateway.invoices.create({ amount: 100, asset: InvoiceAsset.CKB });

      expect(result).toEqual(invoice);
      expect(fetch).toHaveBeenCalledWith(
        `${baseUrl}/invoices`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ amount: 100, asset: InvoiceAsset.CKB }),
          headers: expect.objectContaining({
            authorization: `Bearer ${internalSecret}`,
            "content-type": "application/json",
          }),
        }),
      );
    });

    it("throws FiberGateApiError with the server's code/message/status on a 4xx error envelope", async () => {
      // Each call must get a fresh Response — .json() consumes the body stream once.
      vi.mocked(fetch).mockImplementation(async () =>
        jsonResponse({ data: null, error: { code: "INVALID_AMOUNT", message: "amount must be positive" } }, 400),
      );

      const error = await gateway.invoices.create({ amount: -1, asset: InvoiceAsset.CKB }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(FiberGateApiError);
      expect(error).toMatchObject({
        code: "INVALID_AMOUNT",
        message: "amount must be positive",
        status: 400,
      });
    });

    it("throws a plain Error (not FiberGateApiError) when the response body isn't valid JSON", async () => {
      vi.mocked(fetch).mockResolvedValue(new Response("<html>502 Bad Gateway</html>", { status: 502 }));

      await expect(gateway.invoices.create({ amount: 100, asset: InvoiceAsset.CKB })).rejects.toThrow(
        /non-JSON response/,
      );
    });
  });

  describe("invoices.get", () => {
    it("GETs /invoices/:id with the id URI-encoded", async () => {
      const invoice = makeInvoice({
        id: "inv 1/2",
        status: InvoiceStatus.Paid,
        paid_at: "2026-07-06T14:30:00Z",
      });
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: invoice, error: null }));

      const result = await gateway.invoices.get("inv 1/2");

      expect(result).toEqual(invoice);
      expect(fetch).toHaveBeenCalledWith(
        `${baseUrl}/invoices/${encodeURIComponent("inv 1/2")}`,
        expect.anything(),
      );
    });

    it("throws FiberGateApiError with NOT_FOUND for a missing invoice", async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ data: null, error: { code: "NOT_FOUND", message: "invoice not found" } }, 404),
      );

      await expect(gateway.invoices.get("does-not-exist")).rejects.toMatchObject({
        code: "NOT_FOUND",
        status: 404,
      });
    });
  });

  describe("invoices.list", () => {
    it("builds the query string from filters and surfaces meta.next_cursor", async () => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse({ data: [], error: null, meta: { limit: 10, next_cursor: "cursor_abc" } }),
      );

      const result = await gateway.invoices.list({
        status: InvoiceStatus.Paid,
        asset: InvoiceAsset.CKB,
        limit: 10,
        cursor: "cursor_prev",
      });

      expect(result).toEqual({ invoices: [], limit: 10, next_cursor: "cursor_abc" });
      const [calledUrl] = vi.mocked(fetch).mock.calls[0] as [string];
      const query = new URL(calledUrl).searchParams;
      expect(query.get("status")).toBe("paid");
      expect(query.get("asset")).toBe("CKB");
      expect(query.get("limit")).toBe("10");
      expect(query.get("cursor")).toBe("cursor_prev");
    });

    it("sends no query string when called with no filters", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: [], error: null, meta: { limit: 20 } }));

      await gateway.invoices.list();

      expect(fetch).toHaveBeenCalledWith(`${baseUrl}/invoices`, expect.anything());
    });

    it("falls back to null next_cursor and query-supplied limit when meta is missing", async () => {
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: [], error: null }));

      const result = await gateway.invoices.list({ limit: 5 });

      expect(result).toEqual({ invoices: [], limit: 5, next_cursor: null });
    });
  });

  describe("node.getInfo", () => {
    it("GETs /node/info and returns the node status", async () => {
      const nodeInfo = {
        pubkey: "02abc...",
        active_channels: 3,
        inbound_capacity_ckb: 1000,
        outbound_capacity_ckb: 500,
        status: "online" as const,
      };
      vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: nodeInfo, error: null }));

      const result = await gateway.node.getInfo();

      expect(result).toEqual(nodeInfo);
      expect(fetch).toHaveBeenCalledWith(`${baseUrl}/node/info`, expect.anything());
    });
  });

  it("strips trailing slashes from baseUrl before joining the path", async () => {
    const trailingSlashGateway = new FiberGate({ baseUrl: "http://localhost:3000/api/v1///", internalSecret });
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: [], error: null }));

    await trailingSlashGateway.invoices.list();

    expect(fetch).toHaveBeenCalledWith("http://localhost:3000/api/v1/invoices", expect.anything());
  });
});
