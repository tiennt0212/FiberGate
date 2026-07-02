import { Progress } from "antd";
import { t } from "@/lib/design-tokens";

export type CapacityDirection = "inbound" | "outbound";

const DIRECTION_COLOR: Record<CapacityDirection, string> = {
  inbound: t("--capacity-inbound"),
  outbound: t("--capacity-outbound"),
};

export function CapacityBar({
  label,
  value,
  percent,
  direction,
  caption,
}: {
  label: string;
  value: string;
  percent: number;
  direction: CapacityDirection;
  caption?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-label text-text-muted">{label}</span>
        <span className="text-label font-medium text-text-primary">
          {value}
        </span>
      </div>
      <Progress
        percent={percent}
        showInfo={false}
        strokeColor={DIRECTION_COLOR[direction]}
        trailColor={t("--border-subtle")}
        strokeLinecap="round"
        className="m-0! [&_.ant-progress-bg]:h-[5px]!"
      />
      {caption && (
        <div className="mt-0.5 text-[11px] text-text-subtle">{caption}</div>
      )}
    </div>
  );
}
