import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { requireAuth } from "./auth";

// requireAuth() calls requireEnv("FIBERGATE_INTERNAL_SECRET") for real (not
// mocked) — every test here must set the env var first and clean it up after,
// per harness-brief.md "Reuse opportunities". This is a test-local literal
// only, never the real deployment secret.
const TEST_SECRET = "test-secret";

function requestWithAuthHeader(header: string | undefined): NextRequest {
  const headers: Record<string, string> = {};
  if (header !== undefined) {
    headers.authorization = header;
  }
  return new NextRequest("http://localhost/api/v1/invoices", { headers });
}

describe("requireAuth", () => {
  beforeEach(() => {
    process.env.FIBERGATE_INTERNAL_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.FIBERGATE_INTERNAL_SECRET;
  });

  it("returns null when the Bearer token matches FIBERGATE_INTERNAL_SECRET", () => {
    const request = requestWithAuthHeader(`Bearer ${TEST_SECRET}`);
    expect(requireAuth(request)).toBeNull();
  });

  it("returns a 401 UNAUTHORIZED response when the Authorization header is missing", async () => {
    const request = requestWithAuthHeader(undefined);
    const response = requireAuth(request);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(401);
    const body = (await response?.json()) as Record<string, unknown>;
    expect(body).toEqual({
      data: null,
      error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization token" },
    });
  });

  it("returns a 401 UNAUTHORIZED response when the token does not match", async () => {
    const request = requestWithAuthHeader("Bearer wrong-token");
    const response = requireAuth(request);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(401);
  });

  it("returns a 401 UNAUTHORIZED response when the header is missing the Bearer prefix", () => {
    const request = requestWithAuthHeader(TEST_SECRET);
    const response = requireAuth(request);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(401);
  });

  it("returns a 401 UNAUTHORIZED response for an empty Authorization header", () => {
    const request = requestWithAuthHeader("");
    const response = requireAuth(request);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(401);
  });
});
