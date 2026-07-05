// Single source of truth for the dashboard-auth route paths, shared by
// middleware.ts (redirect target) and app/login/actions.ts (post-login /
// post-logout redirects) so the two never drift out of sync.
//
// The set of *guarded* paths is NOT exported from here — Next.js's
// middleware `config.matcher` must be a literal at its declaration site
// (importing it from another module fails Next's static config extraction
// and silently disables the guard). See the matcher literal + comment in
// middleware.ts, which is the single source of truth for that instead.
// IMPORTANT: adding a new page under apps/web/app/(dashboard)/ does NOT get
// guarded automatically — add its path pattern to middleware.ts's matcher
// too, or it silently ships unprotected.

export const ROUTE = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
} as const;
