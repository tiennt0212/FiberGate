import Link from "next/link";
import {
  ApiOutlined,
  DashboardOutlined,
  RocketOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { ROUTES } from "./routes";

// Menu items for the sidebar. Labels render a real <Link> so nav uses proper
// <a> elements (frontend-exp: routing-semantic-navigation). text-inherit! keeps
// the Link from overriding Menu's selected color (antd-exp: link-color-reset).
export const NAV_ITEMS: MenuProps["items"] = [
  {
    type: "group",
    label: "Main",
    children: [
      {
        key: ROUTES.DASHBOARD,
        icon: <DashboardOutlined />,
        label: (
          <Link href={ROUTES.DASHBOARD} className="text-inherit!">
            Overview
          </Link>
        ),
      },
      {
        key: ROUTES.WEBHOOKS,
        icon: <ApiOutlined />,
        label: (
          <Link href={ROUTES.WEBHOOKS} className="text-inherit!">
            Webhooks
          </Link>
        ),
      },
      {
        key: ROUTES.TRANSACTIONS,
        icon: <SwapOutlined />,
        label: (
          <Link href={ROUTES.TRANSACTIONS} className="text-inherit!">
            Transactions
          </Link>
        ),
      },
    ],
  },
  {
    type: "group",
    label: "Setup",
    children: [
      {
        key: ROUTES.QUICK_START,
        icon: <RocketOutlined />,
        label: (
          <Link href={ROUTES.QUICK_START} className="text-inherit!">
            Quick Start
          </Link>
        ),
      },
    ],
  },
];
