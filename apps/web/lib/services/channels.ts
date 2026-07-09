import { shannonToCkb } from "@/lib/api/format";
import { listChannelsDetailed } from "@/lib/fiber/client";
import type { FiberChannel } from "@/lib/fiber/types";

// Channels page (issue #40) — one service function backs both the list table
// and the row-click detail drawer: listChannelsDetailed() already returns
// every field either view needs in one RPC call, so there is no separate
// per-channel fetch the way invoices/receipt-drawer.tsx needs one (that
// drawer also pulls webhook_deliveries, a second data source; a channel has
// nothing analogous).

export type ChannelStatus = "active" | "closing" | "disabled";

// "closing" is derived from shutdownTransactionHash being set, not by
// string-matching channel.state.stateName — the installed @ckb-ccc/fiber SDK
// types stateName/stateFlags as plain `string` with no documented enum of
// values, so pattern-matching an unconfirmed string would be a guess.
// shutdownTransactionHash is a real, structurally-typed signal a cooperative
// close is in progress. The raw stateName/stateFlags are still surfaced
// as-is in ChannelDetail for the drawer, just not used to drive this badge.
function deriveChannelStatus(channel: Pick<FiberChannel, "enabled" | "shutdownTransactionHash">): ChannelStatus {
  if (channel.shutdownTransactionHash) {
    return "closing";
  }
  return channel.enabled ? "active" : "disabled";
}

export interface ChannelDetail {
  channelId: string;
  peerPubkey: string;
  asset: string;
  localBalanceCkb: number;
  remoteBalanceCkb: number;
  status: ChannelStatus;
  isPublic: boolean;
  channelOutpoint: string;
  stateName: string;
  stateFlags: string;
  offeredTlcBalanceCkb: number;
  receivedTlcBalanceCkb: number;
  /** Epoch milliseconds — see FiberChannel.createdAt's unit caveat. */
  createdAt: number;
  tlcExpiryDelta: number;
  tlcFeeProportionalMillionths: number;
  latestCommitmentTransactionHash: string | null;
  shutdownTransactionHash: string | null;
}

function toChannelDetail(channel: FiberChannel): ChannelDetail {
  return {
    channelId: channel.channelId,
    peerPubkey: channel.peerPubkey,
    asset: channel.asset,
    localBalanceCkb: shannonToCkb(channel.localBalanceShannon),
    remoteBalanceCkb: shannonToCkb(channel.remoteBalanceShannon),
    status: deriveChannelStatus(channel),
    isPublic: channel.isPublic,
    channelOutpoint: channel.channelOutpoint,
    stateName: channel.state.stateName,
    stateFlags: channel.state.stateFlags,
    offeredTlcBalanceCkb: shannonToCkb(channel.offeredTlcBalanceShannon),
    receivedTlcBalanceCkb: shannonToCkb(channel.receivedTlcBalanceShannon),
    createdAt: channel.createdAt,
    // Small protocol parameters (not shannon-scale), safe to narrow to Number.
    tlcExpiryDelta: Number(channel.tlcExpiryDelta),
    tlcFeeProportionalMillionths: Number(channel.tlcFeeProportionalMillionths),
    latestCommitmentTransactionHash: channel.latestCommitmentTransactionHash ?? null,
    shutdownTransactionHash: channel.shutdownTransactionHash ?? null,
  };
}

export async function listChannels(): Promise<ChannelDetail[]> {
  const channels = await listChannelsDetailed();
  return channels.map(toChannelDetail);
}
