import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// requireEnv("DASHBOARD_SESSION_SECRET") is called for real (not mocked) —
// same convention as lib/api/auth.test.ts for FIBERGATE_INTERNAL_SECRET.
// This is a test-local literal only, never the real deployment secret.
const TEST_SECRET = "test-dashboard-session-secret";

const cookieSet = vi.hoisted(() => vi.fn());
const headersGet = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: () => ({ set: cookieSet }),
  headers: () => ({ get: headersGet }),
}));

import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createSessionToken,
  isHttpsRequest,
  setSessionCookie,
  shouldRefreshSession,
  verifySessionToken,
} from "./session";

beforeEach(() => {
  process.env.DASHBOARD_SESSION_SECRET = TEST_SECRET;
  headersGet.mockReturnValue(null);
});

afterEach(() => {
  delete process.env.DASHBOARD_SESSION_SECRET;
  vi.useRealTimers();
  cookieSet.mockClear();
  headersGet.mockClear();
});

describe("createSessionToken / verifySessionToken", () => {
  it("round-trips: a freshly created token verifies as valid with a sub claim", async () => {
    const token = await createSessionToken();
    const payload = await verifySessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("admin");
  });

  it("rejects a token signed with a different secret", async () => {
    // getSigningKey() caches the encoded secret per module instance (see
    // session.ts) — mutating process.env alone wouldn't be picked up by the
    // shared top-level import the other tests use, so this scenario needs
    // two genuinely separate module instances instead.
    vi.resetModules();
    const signer = await import("./session");
    const token = await signer.createSessionToken();

    vi.resetModules();
    process.env.DASHBOARD_SESSION_SECRET = "a-completely-different-secret";
    const verifier = await import("./session");
    const payload = await verifier.verifySessionToken(token);

    expect(payload).toBeNull();
  });

  it("rejects a malformed token", async () => {
    const payload = await verifySessionToken("not-a-real-jwt");

    expect(payload).toBeNull();
  });

  it("rejects an expired token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const token = await createSessionToken();

    // 7-day TTL — 8 days later the token must no longer verify.
    vi.setSystemTime(new Date("2026-01-09T00:00:00Z"));
    const payload = await verifySessionToken(token);

    expect(payload).toBeNull();
  });

  it("throws (does not swallow) when DASHBOARD_SESSION_SECRET is missing — a deployment misconfiguration, not an expected invalid-session case", async () => {
    vi.resetModules();
    delete process.env.DASHBOARD_SESSION_SECRET;
    const fresh = await import("./session");

    await expect(fresh.verifySessionToken("irrelevant-token")).rejects.toThrow(
      "Missing required env var: DASHBOARD_SESSION_SECRET",
    );
  });
});

describe("isHttpsRequest", () => {
  it("returns true for the https X-Forwarded-Proto value", () => {
    expect(isHttpsRequest("https")).toBe(true);
  });

  it("returns false for http", () => {
    expect(isHttpsRequest("http")).toBe(false);
  });

  it("returns false when the header is absent (no reverse proxy — today's default)", () => {
    expect(isHttpsRequest(null)).toBe(false);
  });
});

describe("shouldRefreshSession", () => {
  it("returns false when more than a day remains before exp", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    expect(shouldRefreshSession({ exp: nowSeconds + 60 * 60 * 24 * 3 })).toBe(false);
  });

  it("returns true once less than a day remains before exp", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    expect(shouldRefreshSession({ exp: nowSeconds + 60 * 60 * 12 })).toBe(true);
  });

  it("returns true when the payload has no exp claim", () => {
    expect(shouldRefreshSession({})).toBe(true);
  });
});

describe("setSessionCookie / clearSessionCookie", () => {
  it("sets a non-secure cookie when there's no X-Forwarded-Proto (plain HTTP, today's default deploy)", async () => {
    headersGet.mockReturnValue(null);

    await setSessionCookie();

    expect(cookieSet).toHaveBeenCalledTimes(1);
    const [name, token, options] = cookieSet.mock.calls[0];
    expect(name).toBe(SESSION_COOKIE_NAME);
    expect(typeof token).toBe("string");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", secure: false });
  });

  it("sets a secure cookie when X-Forwarded-Proto is https (TLS-terminating reverse proxy in front)", async () => {
    headersGet.mockReturnValue("https");

    await setSessionCookie();

    const [, , options] = cookieSet.mock.calls[0];
    expect(options).toMatchObject({ secure: true });
  });

  it("clears the cookie with maxAge 0", () => {
    clearSessionCookie();

    expect(cookieSet).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});
