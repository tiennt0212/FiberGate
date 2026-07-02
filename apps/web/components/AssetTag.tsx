import type { Asset } from "@/lib/types";

export function AssetTag({ asset }: { asset: Asset }) {
  return (
    <span className="font-mono inline-block rounded bg-asset-tag-bg px-2 py-0.5 text-[11.5px] font-semibold text-asset-tag-text">
      {asset}
    </span>
  );
}
