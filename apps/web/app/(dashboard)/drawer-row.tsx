import type { ReactNode } from "react";

// Shared by channels/channel-drawer.tsx and peers/peer-drawer.tsx (issue #40
// review cleanup) — both defined a byte-for-byte identical local label/value
// row component before this.
export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12.5px] text-text-muted">{label}</span>
      <span className="text-right text-[12.5px] font-medium text-text-primary">{value}</span>
    </div>
  );
}
