"use client";

import { usePathname } from "next/navigation";
import { Button } from "antd";

import { ROUTE } from "@/lib/auth/routes";

import { useHeaderActionContext } from "./header-action-context";
import { PAGE_TITLES } from "./nav-items";

// Sticky top header: page title (per-route, from nav-items.tsx) + a
// contextual CTA. Overview has none; Quick Start's "View Docs" is a static
// external link with no page interactivity, handled directly here; Invoices/
// Delivery Log ("Export CSV") and Webhooks ("Add Endpoint") need real page
// state, so those come from HeaderActionContext (see header-action-context.tsx).

export function Header() {
  const pathname = usePathname();
  const { action } = useHeaderActionContext();
  const title = (pathname && PAGE_TITLES[pathname]) ?? "";

  return (
    <header className="sticky top-0 z-20 flex h-13 items-center justify-between border-b border-border bg-white px-7">
      <span className="text-[15px] font-semibold text-text-primary">{title}</span>
      <div className="flex items-center gap-2">
        {pathname === ROUTE.QUICK_START ? (
          <a
            href="https://tiennt0212.github.io/FiberGate/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white no-underline! hover:bg-accent-hover"
          >
            View Docs
          </a>
        ) : action ? (
          <Button
            type="primary"
            loading={action.loading}
            onClick={action.onClick}
            className="h-auto! rounded-md! bg-accent! px-3.5! py-1.5! text-[13px]! font-medium! hover:bg-accent-hover!"
          >
            {action.label}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
