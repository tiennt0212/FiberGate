// Shared return shape for Server Actions that only need to report
// success/failure, no payload — used by webhooks/actions.ts and
// settings/actions.ts.
export interface SimpleResult {
  ok: boolean;
  error?: string;
}
