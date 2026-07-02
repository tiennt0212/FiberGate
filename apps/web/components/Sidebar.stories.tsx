import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ROUTES } from "@/lib/routes";
import { Sidebar } from "./Sidebar";

const meta = {
  title: "Components/Sidebar",
  component: Sidebar,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: ROUTES.DASHBOARD },
    },
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DashboardActive: Story = {};

export const WebhooksActive: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: ROUTES.WEBHOOKS },
    },
  },
};
