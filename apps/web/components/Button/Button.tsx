import { Button as AntdButton, type ButtonProps } from "antd";

export type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANT_PROPS: Record<ButtonVariant, ButtonProps> = {
  primary: { type: "primary" },
  secondary: {
    type: "default",
    className: "border-border! hover:bg-hover-subtle!",
  },
  danger: {
    type: "default",
    danger: true,
    size: "small",
    className:
      "bg-danger-soft-bg! border-danger-soft-border! text-danger! rounded-[5px]! hover:bg-danger-soft-hover! hover:text-danger! text-caption!",
  },
};

export type FiberGateButtonProps = Omit<ButtonProps, "variant"> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "secondary",
  className,
  children,
  ...rest
}: FiberGateButtonProps) {
  const preset = VARIANT_PROPS[variant];
  return (
    <AntdButton
      {...preset}
      {...rest}
      className={`${preset.className ?? ""} ${className ?? ""}`}
    >
      {children}
    </AntdButton>
  );
}
