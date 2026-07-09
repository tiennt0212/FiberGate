import { describe, expect, it } from "vitest";

import type { ChannelDetail } from "@/lib/services/channels";

import { getChannelsForPeer } from "./peer-channels";

function stubChannel(overrides: Partial<ChannelDetail>): ChannelDetail {
  return {
    channelId: "0xc",
    peerPubkey: "peerA",
    asset: "CKB",
    localBalanceCkb: 1,
    remoteBalanceCkb: 1,
    status: "active",
    isPublic: true,
    channelOutpoint: "0xo",
    stateName: "ChannelReady",
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

describe("getChannelsForPeer", () => {
  it("filters channels by peerPubkey and sums local+remote across them", () => {
    const channels = [
      stubChannel({ channelId: "0x1", peerPubkey: "peerA", localBalanceCkb: 10, remoteBalanceCkb: 5 }),
      stubChannel({ channelId: "0x2", peerPubkey: "peerA", localBalanceCkb: 2, remoteBalanceCkb: 3 }),
      stubChannel({ channelId: "0x3", peerPubkey: "peerB", localBalanceCkb: 100, remoteBalanceCkb: 100 }),
    ];

    const summary = getChannelsForPeer(channels, "peerA");

    expect(summary.channels.map((c) => c.channelId)).toEqual(["0x1", "0x2"]);
    expect(summary.totalCapacityCkb).toBe(20);
  });

  it("returns an empty summary when the peer has no channels", () => {
    const summary = getChannelsForPeer([], "peerA");

    expect(summary).toEqual({ channels: [], totalCapacityCkb: 0 });
  });
});
