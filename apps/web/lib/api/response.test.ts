import { describe, expect, it } from "vitest";

import { err, internalError, ok } from "./response";

// Contract reference: harness-brief.md "Reuse opportunities" — ok()/err()/
// internalError() exact shape.

describe("ok", () => {
  it("defaults to status 200 and omits meta entirely when not passed", async () => {
    const response = ok({ hello: "world" });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ data: { hello: "world" }, error: null });
    expect("meta" in body).toBe(false);
  });

  it("includes meta when passed", async () => {
    const response = ok({ hello: "world" }, { limit: 20, next_cursor: null });

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      data: { hello: "world" },
      error: null,
      meta: { limit: 20, next_cursor: null },
    });
  });

  it("honors a custom status code", async () => {
    const response = ok({ id: "abc" }, undefined, 201);

    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect("meta" in body).toBe(false);
  });
});

describe("err", () => {
  it("builds the { data: null, error: { code, message } } envelope with the given status", async () => {
    const response = err(400, "INVALID_AMOUNT", "amount must be positive");

    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      data: null,
      error: { code: "INVALID_AMOUNT", message: "amount must be positive" },
    });
  });
});

describe("internalError", () => {
  it("always returns 500 INTERNAL_ERROR with a generic message, never leaking the real error", async () => {
    const response = internalError();

    expect(response.status).toBe(500);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      data: null,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    });
  });
});
