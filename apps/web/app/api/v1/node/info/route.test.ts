import { afterEach, describe, expect, it, vi } from "vitest";

import { FiberRpcTimeoutError } from "@/lib/fiber/types";

// Mock at the @/lib/services/node boundary — the shannon->ckb conversion
// this route used to assert on directly now lives in
// lib/services/node.test.ts. This route has no DB dependency, and is
// intentionally public (no requireAuth() call, see CLAUDE.md's auth-flow
// carve-out for GET /node/info).
vi.mock("@/lib/services/node", () => ({
  getNodeStatus: vi.fn(),
}));

const { getNodeStatus } = await import("@/lib/services/node");
const { GET } = await import("./route");

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /node/info", () => {
  it("returns 200 with the service's result", async () => {
    vi.mocked(getNodeStatus).mockResolvedValue({
      pubkey: "02fee732ac31e04f990dd7e1e25283d714b55f5dba822e3edbd9170557dd7bf0c5",
      active_channels: 3,
      inbound_capacity_ckb: 800,
      outbound_capacity_ckb: 400,
      status: "online",
    });

    const response = await GET();

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Record<string, unknown>; error: null };
    expect(body.error).toBeNull();
    expect(body.data).toEqual({
      pubkey: "02fee732ac31e04f990dd7e1e25283d714b55f5dba822e3edbd9170557dd7bf0c5",
      active_channels: 3,
      inbound_capacity_ckb: 800,
      outbound_capacity_ckb: 400,
      status: "online",
    });
  });

  it("returns 503 NODE_UNAVAILABLE when the Fiber node times out", async () => {
    vi.mocked(getNodeStatus).mockRejectedValue(
      new FiberRpcTimeoutError("node_info", 5000, new Error("aborted")),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    const body = (await response.json()) as { data: null; error: { code: string } };
    expect(body.data).toBeNull();
    expect(body.error.code).toBe("NODE_UNAVAILABLE");
  });

  it("also maps a generic (non-timeout) error to 503 NODE_UNAVAILABLE", async () => {
    vi.mocked(getNodeStatus).mockRejectedValue(new Error("connection reset"));

    const response = await GET();

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("NODE_UNAVAILABLE");
  });
});
