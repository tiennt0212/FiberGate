import { getRecentActivity } from "@/lib/activity-log";

import { ActivityFeed } from "./activity-feed";

export default async function ActivityPage() {
  const initialEntries = getRecentActivity();

  return <ActivityFeed initialEntries={initialEntries} />;
}
