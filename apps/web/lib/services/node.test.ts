import { afterEach, describe, expect, it, vi } from "vitest";

import { FiberRpcTimeoutError } from "@/lib/fiber/types";

vi.mock("@/lib/fiber/client", () => ({
  getNodeInfo: vi.fn(),
}));

const { getNodeInfo } = await import("@/lib/fiber/client");
const { getNodeStatus, getNodeStatusDetail } = await import("./node");

afterEach(() => {
  vi.clearAllMocks();
});

describe("getNodeStatus", () => {
  it("converts capacities from shannon to CKB and reports degraded when a channel is disabled", async () => {
    vi.mocked(getNodeInfo).mockResolvedValue({
      pubkey: "02fee732ac31e04f990dd7e1e25283d714b55f5dba822e3edbd9170557dd7bf0c5",
      version: "0.9.0-rc6",
      commitHash: "abc123",
      totalChannels: 4,
      activeChannels: 3,
      inboundCapacityShannon: 80_000_000_000n,
      outboundCapacityShannon: 40_000_000_000n,
      peerCount: 2,
    });

    const status = await getNodeStatus();

    expect(status).toEqual({
      pubkey: "02fee732ac31e04f990dd7e1e25283d714b55f5dba822e3edbd9170557dd7bf0c5",
      active_channels: 3,
      inbound_capacity_ckb: 800,
      outbound_capacity_ckb: 400,
      status: "degraded",
    });
  });

  it("reports online when every channel is active", async () => {
    vi.mocked(getNodeInfo).mockResolvedValue({
      pubkey: "02fee732ac31e04f990dd7e1e25283d714b55f5dba822e3edbd9170557dd7bf0c5",
      version: "0.9.0-rc6",
      commitHash: "abc123",
      totalChannels: 3,
      activeChannels: 3,
      inboundCapacityShannon: 80_000_000_000n,
      outboundCapacityShannon: 40_000_000_000n,
      peerCount: 2,
    });

    const status = await getNodeStatus();

    expect(status.status).toBe("online");
  });

  it("propagates a Fiber RPC timeout", async () => {
    vi.mocked(getNodeInfo).mockRejectedValue(
      new FiberRpcTimeoutError("node_info", 5000, new Error("aborted")),
    );

    await expect(getNodeStatus()).rejects.toBeInstanceOf(FiberRpcTimeoutError);
  });

  it("propagates a generic (non-timeout) error", async () => {
    vi.mocked(getNodeInfo).mockRejectedValue(new Error("connection reset"));

    await expect(getNodeStatus()).rejects.toThrow("connection reset");
  });
});

describe("getNodeStatusDetail", () => {
  it("includes total_channels, peer_count and version alongside getNodeStatus()'s fields", async () => {
    vi.mocked(getNodeInfo).mockResolvedValue({
      pubkey: "02fee732ac31e04f990dd7e1e25283d714b55f5dba822e3edbd9170557dd7bf0c5",
      version: "0.9.0-rc6",
      commitHash: "abc123",
      totalChannels: 4,
      activeChannels: 4,
      inboundCapacityShannon: 80_000_000_000n,
      outboundCapacityShannon: 40_000_000_000n,
      peerCount: 8,
    });

    const detail = await getNodeStatusDetail();

    expect(detail).toEqual({
      pubkey: "02fee732ac31e04f990dd7e1e25283d714b55f5dba822e3edbd9170557dd7bf0c5",
      total_channels: 4,
      active_channels: 4,
      peer_count: 8,
      inbound_capacity_ckb: 800,
      outbound_capacity_ckb: 400,
      version: "0.9.0-rc6",
      status: "online",
      is_isolated: false,
    });
  });

  it("propagates a Fiber RPC timeout", async () => {
    vi.mocked(getNodeInfo).mockRejectedValue(
      new FiberRpcTimeoutError("node_info", 5000, new Error("aborted")),
    );

    await expect(getNodeStatusDetail()).rejects.toBeInstanceOf(FiberRpcTimeoutError);
  });

  // The point of this flag is that nothing else on the panel changes when it
  // trips — status stays "online", channels still list — so assert that
  // combination, not just the boolean.
  it("flags an isolated node (0 peers) while every other signal still reads healthy", async () => {
    vi.mocked(getNodeInfo).mockResolvedValue({
      pubkey: "02fee732ac31e04f990dd7e1e25283d714b55f5dba822e3edbd9170557dd7bf0c5",
      version: "0.9.0-rc6",
      commitHash: "abc123",
      totalChannels: 2,
      activeChannels: 2,
      inboundCapacityShannon: 80_000_000_000n,
      outboundCapacityShannon: 40_000_000_000n,
      peerCount: 0,
    });

    const detail = await getNodeStatusDetail();

    expect(detail.is_isolated).toBe(true);
    expect(detail.status).toBe("online");
    expect(detail.active_channels).toBe(2);
  });

  it("does not flag a node that has peers", async () => {
    vi.mocked(getNodeInfo).mockResolvedValue({
      pubkey: "02fee732ac31e04f990dd7e1e25283d714b55f5dba822e3edbd9170557dd7bf0c5",
      version: "0.9.0-rc6",
      commitHash: "abc123",
      totalChannels: 1,
      activeChannels: 1,
      inboundCapacityShannon: 0n,
      outboundCapacityShannon: 0n,
      peerCount: 1,
    });

    await expect(getNodeStatusDetail()).resolves.toMatchObject({ is_isolated: false });
  });
});
