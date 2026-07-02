"use client";

import { usePathname } from "next/navigation";
import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { PAGE_TITLES, ROUTES, type Route } from "@/lib/routes";
import { NodeStatusPill } from "./NodeStatusPill";
import type { NodeInfo } from "@/lib/types";

export function Header({ node }: { node: NodeInfo }) {
  const pathname = usePathname() as Route;
  const title = PAGE_TITLES[pathname]?.title ?? "FiberGate";
  const showCta =
    pathname === ROUTES.DASHBOARD || pathname === ROUTES.TRANSACTIONS;

  return (
    <header className="flex h-[52px] items-center justify-between border-b border-border bg-surface px-7">
      <h1 className="text-[15px] font-semibold text-text-primary">{title}</h1>
      <div className="flex items-center gap-3">
        <NodeStatusPill node={node} />
        {showCta && (
          <Button type="primary" icon={<PlusOutlined />}>
            New Invoice
          </Button>
        )}
      </div>
    </header>
  );
}
