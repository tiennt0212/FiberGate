"use client";

import { usePathname } from "next/navigation";
export function ScreenTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-fade-in mx-auto max-w-450">
      {children}
    </div>
  );
}
