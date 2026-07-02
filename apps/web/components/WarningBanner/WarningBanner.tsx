import { Alert } from "antd";
import type { ReactNode } from "react";

export function WarningBanner({
  title,
  description,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <Alert
      type="warning"
      showIcon
      message={title}
      description={description}
      className={`bg-warning-banner-bg! border-warning-banner-border! rounded-card! items-start! [&_.ant-alert-icon]:text-warning-banner-icon! [&_.ant-alert-message]:text-body! [&_.ant-alert-message]:font-semibold! [&_.ant-alert-message]:text-warning-banner-title! [&_.ant-alert-description]:text-[12.5px]! [&_.ant-alert-description]:text-warning-banner-text! ${
        className ?? ""
      }`}
    />
  );
}
