import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock at the module boundary — @/lib/poller/invoice-poller — never let this
// test actually touch the DB/Fiber client (runPollCycle() itself is unit
// tested against those in lib/poller/invoice-poller.test.ts).
vi.mock("@/lib/poller/invoice-poller", () => ({
  runPollCycle: vi.fn(),
}));

const { runPollCycle } = await import("@/lib/poller/invoice-poller");
const { POST } = await import("./route");

const TEST_CRON_SECRET = "test-cron-secret";

function postRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers.authorization = authHeader;
  }
  return new NextRequest("http://localhost/api/cron/poll-invoices", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.mocked(runPollCycle).mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.clearAllMocks();
});

describe("POST /api/cron/poll-invoices", () => {
  it("returns 503 CRON_NOT_CONFIGURED when CRON_SECRET is unset, without running a poll cycle", async () => {
    delete process.env.CRON_SECRET;

    const response = await POST(postRequest("Bearer anything"));

    expect(response.status).toBe(503);
    const body = (await response.json()) as { data: null; error: { code: string } };
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("CRON_NOT_CONFIGURED");
    expect(runPollCycle).not.toHaveBeenCalled();
  });

  it("returns 401 UNAUTHORIZED when the Bearer token doesn't match CRON_SECRET", async () => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;

    const response = await POST(postRequest("Bearer wrong-token"));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(runPollCycle).not.toHaveBeenCalled();
  });

  it("returns 401 UNAUTHORIZED when the Authorization header is missing", async () => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;

    const response = await POST(postRequest());

    expect(response.status).toBe(401);
    expect(runPollCycle).not.toHaveBeenCalled();
  });

  it("returns 200 and runs exactly one poll cycle on a valid CRON_SECRET", async () => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;

    const response = await POST(postRequest(`Bearer ${TEST_CRON_SECRET}`));

    expect(response.status).toBe(200);
    expect(runPollCycle).toHaveBeenCalledTimes(1);
    const body = (await response.json()) as { data: { triggered: boolean }; error: null };
    expect(body.error).toBeNull();
    expect(body.data).toEqual({ triggered: true });
  });

  it("returns 500 INTERNAL_ERROR when runPollCycle throws", async () => {
    process.env.CRON_SECRET = TEST_CRON_SECRET;
    vi.mocked(runPollCycle).mockRejectedValue(new Error("db unreachable"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(postRequest(`Bearer ${TEST_CRON_SECRET}`));

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INTERNAL_ERROR");

    consoleErrorSpy.mockRestore();
  });
});
