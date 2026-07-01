// Monospace rectangle tag for asset symbols (DESIGN.md "Asset Tag").
export function AssetTag({ asset }: { asset: string }) {
  return (
    <span className="inline-block rounded bg-border-subtle px-2 py-[2px] font-mono text-[11.5px] font-semibold text-[#374151]">
      {asset}
    </span>
  );
}
