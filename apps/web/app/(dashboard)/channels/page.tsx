import { listChannels } from "@/lib/services/channels";

import { ChannelsView } from "./channels-view";

// Server Component — thin per CLAUDE.md's service-layer pattern. No
// search-params filtering (unlike Invoices/Delivery Log): a single self-hosted
// merchant's channel count is small enough that one unfiltered table is fine,
// and there's no separate per-channel fetch for the drawer (see channels.ts).
export default async function ChannelsPage() {
  let channels: Awaited<ReturnType<typeof listChannels>> = [];
  let error: string | null = null;
  try {
    channels = await listChannels();
  } catch (fetchError) {
    console.error("Channels: listChannels failed:", fetchError);
    error = "Could not load channels.";
  }

  return <ChannelsView channels={channels} error={error} />;
}
