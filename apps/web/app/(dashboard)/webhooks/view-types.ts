import type { WebhookEndpointRow } from "@/lib/db/schema";

// Plain (non-"use server") module: Next.js requires every export from a
// "use server" file to itself be a callable Server Action, so this
// synchronous shaping helper can't live in actions.ts alongside
// createEndpoint()/toggleEndpointActive()/etc. Both actions.ts (mutations)
// and page.tsx (the initial Server Component read) import it from here so
// the WebhookEndpointRow -> display shape mapping isn't duplicated.

export interface EndpointView {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string | null;
}

export function toEndpointView(row: WebhookEndpointRow): EndpointView {
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    isActive: row.isActive ?? true,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  };
}
