import type { ReactNode } from "react";

import { HeaderActionProvider } from "./header-action-context";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { loadQuickStartStatus } from "./quick-start/status";

// Forces every route under (dashboard)/** to render per-request rather than
// be statically prerendered at build time. Without this, `next build`
// treats any page with no dynamic API usage (Overview, Webhooks, Quick
// Start — Invoices/Delivery Log are already forced dynamic by reading
// `searchParams`) as static, freezing this layout's Quick Start badge and
// those pages' live DB/Fiber data into a single build-time snapshot that
// would never update again in production. This is also an auth-gated
// section (middleware.ts) — it should never be treated as a cacheable
// static asset regardless.
export const dynamic = "force-dynamic";

// Shared shell for every guarded route (middleware.ts's matcher covers all
// 5): sidebar nav + sticky header. Server Component — data-fetching for the
// Quick Start "N/5" badge happens here via the service layer directly
// (CLAUDE.md service-layer pattern), never by fetch()-ing this app's own
// /api/v1/* routes. AntdRegistry is already wired once in the root
// app/layout.tsx — not duplicated here.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { step4Done, step5Done } = await loadQuickStartStatus("Quick Start sidebar badge");

  return (
    <HeaderActionProvider>
      <div className="flex min-h-screen bg-bg text-[14px] text-text-primary">
        <Sidebar step4Done={step4Done} step5Done={step5Done} />
        <div className="ml-60 flex min-h-screen flex-1 flex-col">
          <Header />
          <main className="relative flex-1 px-7 pb-14 pt-7">{children}</main>
        </div>
      </div>
    </HeaderActionProvider>
  );
}
