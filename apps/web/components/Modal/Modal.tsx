"use client";

import { Modal as AntdModal, type ModalProps } from "antd";

// Modal (COMPONENTS.dc.html · 10). 12px content radius, hairline header/footer
// dividers. Slot padding via styles={{ header/body/footer }} — bodyStyle and
// headerStyle are deprecated in Antd v5.
export function Modal({ className, styles, children, ...rest }: ModalProps) {
  return (
    <AntdModal
      width={480}
      className={`[&_.ant-modal-content]:rounded-modal! [&_.ant-modal-content]:p-0! ${
        className ?? ""
      }`}
      styles={{
        header: {
          padding: "20px 24px 16px",
          marginBottom: 0,
          borderBottom: "1px solid var(--border-subtle)",
        },
        body: { padding: "20px 24px" },
        footer: {
          padding: "14px 24px 18px",
          marginTop: 0,
          borderTop: "1px solid var(--border-subtle)",
        },
        ...styles,
      }}
      {...rest}
    >
      {children}
    </AntdModal>
  );
}
