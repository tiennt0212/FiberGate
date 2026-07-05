import { describe, expect, it } from "vitest";

import { invoiceStatusEnum } from "../db/schema";
import {
  ApiValidationError,
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  SHANNON_PER_CKB,
  validateCreateInvoiceInput,
  validateListInvoicesQuery,
} from "./validation";

// Assertions target `.code`, not just "some error was thrown" — the route
// handlers forward `.code` straight into err(status, code, message), so a
// wrong code here would silently ship the wrong HTTP error code.

describe("validateCreateInvoiceInput", () => {
  it("accepts a valid minimal body and normalizes it, applying the default expires_in", () => {
    const result = validateCreateInvoiceInput({ amount: 1.5, asset: "CKB" });

    expect(result.amountCkb).toBe(1.5);
    expect(result.amountShannon).toBe(BigInt(Math.round(1.5 * SHANNON_PER_CKB)));
    expect(result.asset).toBe("CKB");
    expect(result.expiresInSeconds).toBe(3600);
    expect(result.description).toBeUndefined();
    expect(result.metadata).toBeUndefined();
  });

  it("accepts a fully populated body", () => {
    const result = validateCreateInvoiceInput({
      amount: 10,
      asset: "CKB",
      description: "Order #123",
      expires_in: 120,
      metadata: { orderId: "123" },
    });

    expect(result.description).toBe("Order #123");
    expect(result.expiresInSeconds).toBe(120);
    expect(result.metadata).toEqual({ orderId: "123" });
  });

  it("throws VALIDATION_ERROR when the body is not a JSON object", () => {
    expect.assertions(2);
    try {
      validateCreateInvoiceInput("not an object");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiValidationError);
      expect((error as ApiValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("throws VALIDATION_ERROR for a null body", () => {
    expect.assertions(1);
    try {
      validateCreateInvoiceInput(null);
    } catch (error) {
      expect((error as ApiValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it.each([
    ["non-number", { amount: "1.5", asset: "CKB" }],
    ["NaN", { amount: Number.NaN, asset: "CKB" }],
    ["Infinity", { amount: Number.POSITIVE_INFINITY, asset: "CKB" }],
    ["below minimum", { amount: 0.01, asset: "CKB" }],
    ["above maximum", { amount: 1001, asset: "CKB" }],
    ["zero", { amount: 0, asset: "CKB" }],
  ])("throws INVALID_AMOUNT for amount = %s", (_label, body) => {
    expect.assertions(1);
    try {
      validateCreateInvoiceInput(body);
    } catch (error) {
      expect((error as ApiValidationError).code).toBe("INVALID_AMOUNT");
    }
  });

  it.each([
    ["unsupported string", { amount: 1, asset: "USD" }],
    ["non-string", { amount: 1, asset: 123 }],
    ["missing", { amount: 1 }],
  ])("throws UNSUPPORTED_ASSET for asset = %s", (_label, body) => {
    expect.assertions(1);
    try {
      validateCreateInvoiceInput(body);
    } catch (error) {
      expect((error as ApiValidationError).code).toBe("UNSUPPORTED_ASSET");
    }
  });

  it("throws VALIDATION_ERROR when description is not a string", () => {
    expect.assertions(1);
    try {
      validateCreateInvoiceInput({ amount: 1, asset: "CKB", description: 42 });
    } catch (error) {
      expect((error as ApiValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it.each([
    ["non-integer", { amount: 1, asset: "CKB", expires_in: 1.5 }],
    ["below minimum", { amount: 1, asset: "CKB", expires_in: 0 }],
    ["above maximum", { amount: 1, asset: "CKB", expires_in: 86401 }],
    ["wrong type", { amount: 1, asset: "CKB", expires_in: "3600" }],
  ])("throws VALIDATION_ERROR for malformed expires_in = %s", (_label, body) => {
    expect.assertions(1);
    try {
      validateCreateInvoiceInput(body);
    } catch (error) {
      expect((error as ApiValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("throws VALIDATION_ERROR when metadata is not a plain object", () => {
    expect.assertions(1);
    try {
      validateCreateInvoiceInput({ amount: 1, asset: "CKB", metadata: ["not", "an", "object"] });
    } catch (error) {
      expect((error as ApiValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("computes amountShannon as round(amount * 1e8) per BR-INV-004", () => {
    const result = validateCreateInvoiceInput({ amount: 0.1, asset: "CKB" });
    expect(result.amountShannon).toBe(10_000_000n);
  });
});

describe("validateListInvoicesQuery", () => {
  it("returns defaults when no query params are given", () => {
    const result = validateListInvoicesQuery(new URLSearchParams());
    expect(result).toEqual({
      status: undefined,
      asset: undefined,
      limit: DEFAULT_LIST_LIMIT,
      cursor: undefined,
    });
  });

  it.each(invoiceStatusEnum.enumValues)("accepts a valid status filter: %s", (status) => {
    const result = validateListInvoicesQuery(new URLSearchParams({ status }));
    expect(result.status).toBe(status);
  });

  it("throws VALIDATION_ERROR for an unknown status", () => {
    expect.assertions(1);
    try {
      validateListInvoicesQuery(new URLSearchParams({ status: "bogus" }));
    } catch (error) {
      expect((error as ApiValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("accepts a valid asset filter", () => {
    const result = validateListInvoicesQuery(new URLSearchParams({ asset: "CKB" }));
    expect(result.asset).toBe("CKB");
  });

  it("throws VALIDATION_ERROR for an unknown asset", () => {
    expect.assertions(1);
    try {
      validateListInvoicesQuery(new URLSearchParams({ asset: "USD" }));
    } catch (error) {
      expect((error as ApiValidationError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("clamps limit to MAX_LIST_LIMIT (BR-RTE-002) instead of rejecting it", () => {
    const result = validateListInvoicesQuery(new URLSearchParams({ limit: "500" }));
    expect(result.limit).toBe(MAX_LIST_LIMIT);
  });

  it.each(["0", "-5", "1.5", "not-a-number"])(
    "throws VALIDATION_ERROR for an invalid limit = %s",
    (limit) => {
      expect.assertions(1);
      try {
        validateListInvoicesQuery(new URLSearchParams({ limit }));
      } catch (error) {
        expect((error as ApiValidationError).code).toBe("VALIDATION_ERROR");
      }
    },
  );

  it("passes cursor through unmodified", () => {
    const result = validateListInvoicesQuery(new URLSearchParams({ cursor: "opaque-cursor" }));
    expect(result.cursor).toBe("opaque-cursor");
  });

  it("normalizes an explicitly empty cursor to undefined, same as an omitted one", () => {
    const result = validateListInvoicesQuery(new URLSearchParams({ cursor: "" }));
    expect(result.cursor).toBeUndefined();
  });
});
