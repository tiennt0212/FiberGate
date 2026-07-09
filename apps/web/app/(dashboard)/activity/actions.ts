"use server";

import { getRecentActivity, type ActivityLogEntry } from "@/lib/activity-log";

// Polled by activity-feed.tsx's client-side setInterval — the ring buffer
// lives in the fibergate-core process (lib/activity-log.ts), there's nothing
// to await beyond reading it back.
export async function fetchRecentActivity(): Promise<ActivityLogEntry[]> {
  return getRecentActivity();
}
