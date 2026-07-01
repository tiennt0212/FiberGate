"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "antd";

const TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/webhooks": "Webhooks",
  "/transactions": "Transactions",
};

export function DashboardHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  const title =
    Object.entries(TITLES).find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1] ??
    "Dashboard";

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-border bg-surface px-7">
      <span className="text-[15px] font-semibold text-ink">{title}</span>
      <Button size="small" onClick={logout} loading={loading}>
        Sign out
      </Button>
    </header>
  );
}
