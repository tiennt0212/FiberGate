import { listChannels } from "@/lib/services/channels";

import { firstParam } from "../search-params";

import { ChannelsView } from "./channels-view";

// Server Component — thin per CLAUDE.md's service-layer pattern. The only
// search-param read (unlike Invoices/Delivery Log's full filter bar) is
// `channel`, a deep link from the Peer Drawer's channel list — a single
// self-hosted merchant's channel count is small enough that a full filter
// bar isn't needed, and there's no separate per-channel fetch for the drawer
// (see channels.ts).
export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  let channels: Awaited<ReturnType<typeof listChannels>> = [];
  let error: string | null = null;
  try {
    channels = await listChannels();
  } catch (fetchError) {
    console.error("Channels: listChannels failed:", fetchError);
    error = "Could not load channels.";
  }

  return <ChannelsView channels={channels} error={error} openChannelId={firstParam(searchParams.channel) ?? null} />;
}
