import type { ThemeConfig } from "antd";
import { px, t } from "@/lib/design-tokens";

export const theme: ThemeConfig = {
  token: {
    colorPrimary: t("--accent"),
    colorLink: t("--accent"),
    colorLinkHover: t("--accent-hover"),
    colorSuccess: t("--success"),
    colorWarning: t("--warning"),
    colorError: t("--danger"),
    colorBgLayout: t("--bg"),
    colorBgContainer: t("--surface"),
    colorBorder: t("--border"),
    colorBorderSecondary: t("--border-subtle"),
    colorText: t("--text-primary"),
    colorTextSecondary: t("--text-secondary"),
    colorTextTertiary: t("--text-muted"),
    borderRadius: px("--radius-button"),
    borderRadiusLG: px("--radius-card"),
    fontFamily: t("--font-ui"),
    fontSize: px("--fs-body"),
    controlHeight: 34,
  },
  components: {
    Card: {
      borderRadiusLG: px("--radius-card"),
      paddingLG: px("--space-xl"),
    },
    Table: {
      headerBg: t("--table-header-bg"),
      headerColor: t("--text-xsubtle"),
      headerSplitColor: "transparent",
      rowHoverBg: t("--row-hover"),
      cellPaddingBlock: px("--space-md"),
      cellPaddingInline: px("--space-lg"),
      borderColor: t("--border-subtle"),
      fontSize: px("--fs-body"),
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: t("--accent-light"),
      itemSelectedColor: t("--accent"),
      itemColor: t("--text-secondary"),
      itemHoverBg: t("--hover-subtle"),
      itemBorderRadius: px("--radius-button"),
      itemHeight: 36,
      iconSize: px("--space-lg"),
    },
    Layout: {
      siderBg: t("--surface"),
      headerBg: t("--surface"),
      headerHeight: px("--header-height"),
      bodyBg: t("--bg"),
    },
    Button: {
      primaryShadow: "none",
      defaultShadow: "none",
    },
  },
};
