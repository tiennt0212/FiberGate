"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu } from "antd";
import { NAV_ITEMS } from "@/lib/nav-items";
import { ROUTES } from "@/lib/routes";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-surface">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-white">
          F
        </span>
        <span className="text-[15px] font-bold text-text-primary">
          FiberGate
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={NAV_ITEMS}
          style={{ border: "none", background: "transparent" }}
        />
      </nav>

      {/* Bottom */}
      <div className="border-t border-border-focus px-4 py-3">
        <a
          href="https://www.fiber.world/docs"
          target="_blank"
          rel="noreferrer"
          className="block text-[13px] text-text-secondary hover:text-accent"
        >
          Docs ↗
        </a>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-light text-[11px] font-semibold text-accent">
            A
          </span>
          <span className="text-[12px] text-text-muted">admin</span>
        </div>
      </div>
    </aside>
  );
}

// Named export kept for potential reuse of the login-safe logo elsewhere.
export function BrandLogo() {
  return (
    <Link href={ROUTES.DASHBOARD} className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
        F
      </span>
      <span className="text-[17px] font-bold text-text-primary">FiberGate</span>
    </Link>
  );
}
