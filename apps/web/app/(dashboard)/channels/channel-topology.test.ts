import { describe, expect, it } from "vitest";

import type { ChannelDetail } from "@/lib/services/channels";

import { computeTopology } from "./channel-topology";

function stubChannel(overrides: Partial<ChannelDetail>): ChannelDetail {
  return {
    channelId: "0xc",
    peerPubkey: "peer",
    asset: "CKB",
    localBalanceCkb: 1,
    remoteBalanceCkb: 1,
    status: "active",
    isPublic: true,
    channelOutpoint: "0xo",
    stateName: "CHANNEL_READY",
    stateFlags: "0x0",
    offeredTlcBalanceCkb: 0,
    receivedTlcBalanceCkb: 0,
    createdAt: 0,
    tlcExpiryDelta: 0,
    tlcFeeProportionalMillionths: 0,
    latestCommitmentTransactionHash: null,
    shutdownTransactionHash: null,
    ...overrides,
  };
}

describe("computeTopology", () => {
  it("returns one node per distinct peer, not per channel", () => {
    const nodes = computeTopology([
      stubChannel({ peerPubkey: "peerA", status: "active" }),
      stubChannel({ peerPubkey: "peerA", status: "disabled" }),
      stubChannel({ peerPubkey: "peerB", status: "closing" }),
    ]);

    expect(nodes).toHaveLength(2);
  });

  it("colors a peer green if any of its channels is active, even if another is disabled", () => {
    const nodes = computeTopology([
      stubChannel({ peerPubkey: "peerA", status: "disabled" }),
      stubChannel({ peerPubkey: "peerA", status: "active" }),
    ]);

    expect(nodes[0]?.color).toBe("#16a34a");
  });

  it("returns an empty array for no channels", () => {
    expect(computeTopology([])).toEqual([]);
  });
});
