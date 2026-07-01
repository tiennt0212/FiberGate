"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
        <rect x="8.5" y="1.5" width="5" height="5" rx="1" />
        <rect x="1.5" y="8.5" width="5" height="5" rx="1" />
        <rect x="8.5" y="8.5" width="5" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: "/webhooks",
    label: "Webhooks",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.5L3.5 8H8L6 13.5L13.5 6H9.5z" />
      </svg>
    ),
  },
  {
    href: "/transactions",
    label: "Transactions",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="2" y="1.5" width="11" height="12" rx="1.5" />
        <line x1="5" y1="5" x2="10" y2="5" />
        <line x1="5" y1="7.8" x2="10" y2="7.8" />
        <line x1="5" y1="10.5" x2="8" y2="10.5" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r border-border bg-surface">
      <div className="border-b border-border-focus px-4 pb-[14px] pt-[18px]">
        <div className="flex items-center gap-[9px]">
          <BrandMark size={32} />
          <div>
            <div className="text-[14.5px] font-bold leading-tight text-ink">FiberGate</div>
            <div className="mt-[1px] text-[11px] leading-tight text-subtle">
              Self-Hosted Payment Gateway
            </div>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-[1px] overflow-y-auto p-[10px]">
        <div className="px-[6px] py-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-faint">
          Main
        </div>
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-[9px] rounded-md px-[10px] py-[7px] text-[13.5px] no-underline"
              style={{
                background: active ? "#eef2ff" : "transparent",
                color: active ? "#4f46e5" : "#52525b",
                fontWeight: active ? 600 : 400,
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-[2px] border-t border-border-focus px-[10px] pb-3 pt-[10px]">
        <a
          href="https://www.fiber.world/docs"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md px-[10px] py-[7px] text-[13px] text-muted no-underline hover:bg-border-subtle"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 1H3C2 1 1 2 1 3v8c0 1 1 2 2 2h8c1 0 2-1 2-2V7" />
            <path d="M8 1H13V6M13 1L8 6" />
          </svg>
          Documentation
        </a>
        <div className="flex items-center gap-2 rounded-md px-[10px] py-[7px]">
          <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full bg-success" />
          <span className="text-[12.5px] font-medium text-[#374151]">Admin</span>
          <span className="ml-auto text-[11px] text-subtle">self-hosted</span>
        </div>
      </div>
    </aside>
  );
}
