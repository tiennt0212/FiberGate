import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { nodeInfo } from "@/lib/mock/data";
import { ROUTES } from "@/lib/routes";
import { Header } from "./Header";

const meta = {
  title: "Components/Header",
  component: Header,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: ROUTES.DASHBOARD },
    },
  },
  args: { node: nodeInfo },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dashboard: Story = {};

export const NodeOffline: Story = {
  args: { node: { ...nodeInfo, status: "offline" } },
};

export const WebhooksNoCta: Story = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: { pathname: ROUTES.WEBHOOKS },
    },
  },
};
