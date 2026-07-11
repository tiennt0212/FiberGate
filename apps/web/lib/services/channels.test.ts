import { afterEach, describe, expect, it, vi } from "vitest";

import type { FiberChannel } from "@/lib/fiber/types";

vi.mock("@/lib/fiber/client", () => ({
  listChannelsDetailed: vi.fn(),
}));

const { listChannelsDetailed } = await import("@/lib/fiber/client");
const { listChannels } = await import("./channels");

afterEach(() => {
  vi.clearAllMocks();
});

function baseChannel(overrides: Partial<FiberChannel> = {}): FiberChannel {
  return {
    channelId: "0xchannel1",
    peerPubkey: "02aaaa",
    isPublic: true,
    channelOutpoint: "0xoutpoint1",
    asset: "CKB",
    state: { stateName: "CHANNEL_READY", stateFlags: "0x0" },
    localBalanceShannon: 100_000_000n,
    remoteBalanceShannon: 200_000_000n,
    offeredTlcBalanceShannon: 0n,
    receivedTlcBalanceShannon: 0n,
    createdAt: 1_720_000_000_000,
    enabled: true,
    tlcExpiryDelta: 20n,
    tlcFeeProportionalMillionths: 1000n,
    latestCommitmentTransactionHash: undefined,
    shutdownTransactionHash: undefined,
    ...overrides,
  };
}

describe("listChannels", () => {
  it("converts shannon balances to CKB and marks an enabled channel as active", async () => {
    vi.mocked(listChannelsDetailed).mockResolvedValue([baseChannel()]);

    const [channel] = await listChannels();

    expect(channel).toMatchObject({
      channelId: "0xchannel1",
      peerPubkey: "02aaaa",
      asset: "CKB",
      localBalanceCkb: 1,
      remoteBalanceCkb: 2,
      status: "active",
      isPublic: true,
      tlcExpiryDelta: 20,
      tlcFeeProportionalMillionths: 1000,
      latestCommitmentTransactionHash: null,
      shutdownTransactionHash: null,
    });
  });

  it("marks a channel with a shutdown tx hash as closing, even if still enabled", async () => {
    vi.mocked(listChannelsDetailed).mockResolvedValue([
      baseChannel({ enabled: true, shutdownTransactionHash: "0xshutdown" }),
    ]);

    const [channel] = await listChannels();

    expect(channel.status).toBe("closing");
    expect(channel.shutdownTransactionHash).toBe("0xshutdown");
  });

  it("marks a disabled channel with no shutdown tx as disabled", async () => {
    vi.mocked(listChannelsDetailed).mockResolvedValue([baseChannel({ enabled: false })]);

    const [channel] = await listChannels();

    expect(channel.status).toBe("disabled");
  });
});
