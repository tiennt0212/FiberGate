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
    <header className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-[#e4e4e7] bg-white px-7">
      <span className="text-[15px] font-semibold text-[#141414]">{title}</span>
      <div className="flex items-center gap-2">
        {pathname === ROUTE.QUICK_START ? (
          <a
            href="https://www.fiber.world/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#4f46e5] px-3.5 py-1.5 text-[13px] font-medium text-white no-underline! hover:bg-[#4338ca]"
          >
            View Docs
          </a>
        ) : action ? (
          <Button
            type="primary"
            loading={action.loading}
            onClick={action.onClick}
            className="h-auto! rounded-[6px]! bg-[#4f46e5]! px-3.5! py-1.5! text-[13px]! font-medium! hover:bg-[#4338ca]!"
          >
            {action.label}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
