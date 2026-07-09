"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, type MenuProps } from "antd";

import { logout } from "@/app/login/actions";

import { MAIN_NAV_ITEMS, SETUP_NAV_ITEMS, type DashboardNavItem } from "./nav-items";
import { useQuickStartProgress } from "./quick-start/use-quick-start-progress";

// Client sub-component for nav active-state highlighting (usePathname()),
// following the same "use client" split app/login/page.tsx already
// establishes — layout.tsx itself stays a Server Component.

function navItemToMenuItem(item: DashboardNavItem, badge?: string): NonNullable<MenuProps["items"]>[number] {
  return {
    key: item.route,
    icon: item.icon,
    label: (
      <Link href={item.route} className="text-inherit! no-underline! flex! w-full! items-center! justify-between! gap-2!">
        <span>{item.label}</span>
        {badge ? (
          <span className="ml-auto rounded-full! bg-[#ede9fe] px-1.75 py-0.5 text-[10.5px] font-semibold text-[#5b21b6]">
            {badge}
          </span>
        ) : null}
      </Link>
    ),
    className: "flex! gap-4! items-center! p-2! m-0!"
  };
}

export function Sidebar({ step4Done, step5Done }: { step4Done: boolean; step5Done: boolean }) {
  const pathname = usePathname();
  const { completedSteps, totalSteps } = useQuickStartProgress(step4Done, step5Done);

  const items: MenuProps["items"] = [
    {
      key: "main-group",
      type: "group",
      label: "Main",
      children: MAIN_NAV_ITEMS.map((item) => navItemToMenuItem(item)),
    },
    {
      key: "setup-group",
      type: "group",
      label: "Setup",
      children: SETUP_NAV_ITEMS.map((item) => navItemToMenuItem(item, `${completedSteps}/${totalSteps}`)),
    },
  ];

  const selectedKeys = pathname ? [pathname] : [];

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-30 flex min-h-screen w-60 flex-col border-r border-border bg-white">
      <div className="border-b border-border-focus px-4 pb-3.5 pt-4.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="4.5" cy="9" r="3" fill="white" opacity=".95" />
              <circle cx="14" cy="4.5" r="2" fill="white" opacity=".7" />
              <circle cx="14" cy="13.5" r="2" fill="white" opacity=".7" />
              <line x1="7.4" y1="7.8" x2="12.1" y2="5.3" stroke="white" strokeWidth="1.1" opacity=".55" />
              <line x1="7.4" y1="10.2" x2="12.1" y2="12.7" stroke="white" strokeWidth="1.1" opacity=".55" />
            </svg>
          </div>
          <div>
            <div className="text-[14.5px] font-bold leading-tight text-text-primary">FiberGate</div>
            <div className="mt-px text-[11px] leading-tight text-text-subtle">Self-Hosted Payment Gateway</div>
          </div>
        </div>
      </div>

      <Menu
        mode="inline"
        selectedKeys={selectedKeys}
        items={items}
        inlineIndent={0}
        className="flex-1! overflow-y-auto! border-0! bg-transparent! px-2! py-2.5!
          [&_.ant-menu-item-group-title]:px-1.5!
          [&_.ant-menu-item-group-title]:text-[10.5px]!
          [&_.ant-menu-item-group-title]:font-semibold!
          [&_.ant-menu-item-group-title]:uppercase!
          [&_.ant-menu-item-group-title]:tracking-[0.07em]!
          [&_.ant-menu-item-group-title]:text-[#c0bfcc]!
          [&_.ant-menu-item]:mx-0.5!
          [&_.ant-menu-item]:rounded-md!
          [&_.ant-menu-item]:text-[13.5px]!
          [&_.ant-menu-item]:text-text-secondary!
          [&_.ant-menu-item-selected]:bg-accent-light!
          [&_.ant-menu-item-selected]:font-semibold!
          [&_.ant-menu-item-selected]:text-accent!"
      />

      <div className="flex flex-col gap-0.5 border-t border-border-focus px-2.5 pb-3 pt-2.5">
        <a
          href="https://www.fiber.world/docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-text-muted no-underline! hover:bg-surface-hover hover:text-text-strong"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 1H3C2 1 1 2 1 3v8c0 1 1 2 2 2h8c1 0 2-1 2-2V7" />
            <path d="M8 1H13V6M13 1L8 6" />
          </svg>
          Documentation
        </a>
        <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5">
          <div className="h-1.75 w-1.75 shrink-0 rounded-full bg-success" />
          <span className="text-[12.5px] font-medium text-text-strong">Admin</span>
          <span className="ml-auto text-[11px] text-text-subtle">self-hosted</span>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="w-full cursor-pointer rounded-md border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] text-text-muted hover:bg-surface-hover hover:text-danger"
          >
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
