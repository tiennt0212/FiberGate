"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider, theme } from "antd";
import type { ReactNode } from "react";

// Antd theme aligned to DESIGN.md tokens. AntdRegistry avoids the SSR style flash.
const fibergateTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#4f46e5",
    colorLink: "#4f46e5",
    colorSuccess: "#16a34a",
    colorWarning: "#f59e0b",
    colorError: "#dc2626",
    colorBorder: "#e4e4e7",
    colorBorderSecondary: "#f3f4f6",
    colorText: "#141414",
    colorTextSecondary: "#52525b",
    borderRadius: 6,
    borderRadiusLG: 8,
    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    controlHeight: 34,
  },
  components: {
    Card: { borderRadiusLG: 8 },
    Table: { headerBg: "#f9f9fb", headerColor: "#9898a8", rowHoverBg: "#f9f9fb" },
    Layout: { bodyBg: "#f7f7f8", headerBg: "#ffffff", siderBg: "#ffffff" },
  },
} as const;

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider theme={fibergateTheme}>
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
