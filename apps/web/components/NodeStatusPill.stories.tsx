import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { nodeInfo } from "@/lib/mock/data";
import { NodeStatusPill } from "./NodeStatusPill";

const meta = {
  title: "Components/NodeStatusPill",
  component: NodeStatusPill,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof NodeStatusPill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Online: Story = {
  args: { node: nodeInfo },
};

export const Offline: Story = {
  args: { node: { ...nodeInfo, status: "offline" } },
};
