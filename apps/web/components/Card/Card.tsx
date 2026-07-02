import { Card as AntdCard, type CardProps } from "antd";

export function Card({ className, styles, children, ...rest }: CardProps) {
  return (
    <AntdCard
      className={`bg-surface border-border! rounded-card transition-colors hover:border-card-hover! ${className ?? ""}`}
      styles={{ body: { padding: "18px 20px" }, ...styles }}
      {...rest}
    >
      {children}
    </AntdCard>
  );
}
