import { cache } from "react";

import { hasPaidInvoice } from "@/lib/services/invoices";
import { listWebhookEndpoints } from "@/lib/services/webhooks";

// Server-only composition of the 2 real-data Quick Start signals (steps 4/5
// — harness-brief.md issue #10 Resolved Decision #2). Colocated with the
// Quick Start page (its primary owner) rather than added to lib/services/*,
// since it's not a reusable domain query — just a thin combination of 2
// already-existing service calls for one UI feature. Both
// (dashboard)/layout.tsx (sidebar "N/5" badge) and quick-start/page.tsx (the
// step cards themselves) import this so the two never disagree about
// whether step 4/5 are done.
//
// Step 3 ("Install the SDK — Mark as done") has no signal here at all — it
// is tracked client-side only via localStorage (Resolved Decision #2), never
// server-derived.
export interface QuickStartStatus {
  step4Done: boolean;
  step5Done: boolean;
}

// Wrapped in React's cache() so layout.tsx's sidebar badge and
// quick-start/page.tsx's step cards — both called within the same request
// when visiting /quick-start — dedupe into a single underlying call instead
// of each re-running hasPaidInvoice()/listWebhookEndpoints() independently
// (standard Next.js App Router pattern for sharing a Server Component data
// fetch across multiple call sites in one request). The 2 underlying
// queries touch unrelated tables, so they also run in parallel via
// Promise.all instead of sequentially.
export const getQuickStartStatus = cache(async (): Promise<QuickStartStatus> => {
  const [step4Done, endpoints] = await Promise.all([hasPaidInvoice(), listWebhookEndpoints()]);
  const step5Done = step4Done && endpoints.some((endpoint) => endpoint.isActive);
  return { step4Done, step5Done };
});
