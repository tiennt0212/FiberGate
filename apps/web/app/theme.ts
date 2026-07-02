import type { ThemeConfig } from "antd";

// Antd v5 theme — token values mirror .context/design/DESIGN.md.
// Passed to <ConfigProvider theme={theme}> in the root layout.
export const theme: ThemeConfig = {
  token: {
    colorPrimary: "#4f46e5",
    colorLink: "#4f46e5",
    colorLinkHover: "#4338ca",
    colorSuccess: "#16a34a",
    colorWarning: "#f59e0b",
    colorError: "#dc2626",
    colorBgLayout: "#f7f7f8",
    colorBgContainer: "#ffffff",
    colorBorder: "#e4e4e7",
    colorBorderSecondary: "#f3f4f6",
    colorText: "#141414",
    colorTextSecondary: "#52525b",
    colorTextTertiary: "#71717a",
    borderRadius: 6,
    borderRadiusLG: 8,
    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    fontSize: 13,
    controlHeight: 34,
  },
  components: {
    Card: {
      borderRadiusLG: 8,
      paddingLG: 20,
    },
    Table: {
      headerBg: "#f9f9fb",
      headerColor: "#9898a8",
      headerSplitColor: "transparent",
      rowHoverBg: "#f9f9fb",
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
      borderColor: "#f3f4f6",
      fontSize: 13,
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: "#eef2ff",
      itemSelectedColor: "#4f46e5",
      itemColor: "#52525b",
      itemHoverBg: "#f4f4f5",
      itemBorderRadius: 6,
      itemHeight: 36,
      iconSize: 16,
    },
    Layout: {
      siderBg: "#ffffff",
      headerBg: "#ffffff",
      headerHeight: 52,
      bodyBg: "#f7f7f8",
    },
    Button: {
      primaryShadow: "none",
      defaultShadow: "none",
    },
  },
};
