import { Segmented } from "antd";
import type { ReactNode } from "react";

export interface FilterOption<T extends string> {
  label: ReactNode;
  value: T;
}
s
export function FilterGroup<T extends string>({
  options,
  value,
  onChange,
  mono = false,
  className,
}: {
  options: readonly (T | FilterOption<T>)[];
  value: T;
  onChange: (value: T) => void;
  mono?: boolean;
  className?: string;
}) {
  return (
    <Segmented<T>
      value={value}
      onChange={onChange}
      options={[...options]}
      className={`border border-border! bg-surface! ${
        mono ? "font-mono font-semibold" : ""
      } ${className ?? ""}`}
    />
  );
}
