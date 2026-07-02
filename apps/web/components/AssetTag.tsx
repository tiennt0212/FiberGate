import type { Asset } from "@/lib/types";

// Monospace rectangle tag for asset symbols (DESIGN.md → "Asset Tag").
export function AssetTag({ asset }: { asset: Asset }) {
  return (
    <span className="font-mono inline-block rounded bg-border-subtle px-2 py-0.5 text-[11.5px] font-semibold text-[#374151]">
      {asset}
    </span>
  );
}
