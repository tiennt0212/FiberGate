import type { ChannelDetail } from "@/lib/services/channels";

// Deliberately its own tiny client-safe module, NOT lib/services/channels.ts:
// that file imports lib/fiber/client.ts (node:crypto, a FiberSDK singleton
// requiring env vars at module scope) — fine for Server Components, but
// channels-view.tsx and peer-channels.ts both import this from "use client"
// components (channels-view.tsx, peer-drawer.tsx), and pulling any runtime
// export out of a server-only module into a client bundle fails the webpack
// build outright ("node:crypto ... Unhandled scheme"). Only `ChannelDetail`
// is imported here, and only as a type — erased at compile time, so this
// file has zero runtime dependency on the server-only module.
//
// Shared by channels-view.tsx (all channels' combined balance) and
// peers/peer-channels.ts (one peer's total capacity) — same known CKB/RUSD-
// decimals simplification as the rest of the app (decisions-log.md issue
// #27): sums across assets without converting between them, just like
// getInvoiceStats()'s paidVolumeByAsset does per-asset rather than a single
// blended total.
export function sumCapacityCkb(channels: ChannelDetail[]): number {
  return channels.reduce((sum, channel) => sum + channel.localBalanceCkb + channel.remoteBalanceCkb, 0);
}
