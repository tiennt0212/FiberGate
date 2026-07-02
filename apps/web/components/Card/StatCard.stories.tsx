import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatCard } from "./StatCard";

const meta = {
  title: "Components/StatCard",
  component: StatCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[280px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PositiveDelta: Story = {
  args: {
    label: "Total Volume (30d)",
    value: "12,450 CKB",
    sub: "+ 142 RUSD",
    delta: { value: "12.4% vs last period", positive: true },
  },
};

export const NegativeDelta: Story = {
  args: {
    label: "Invoices Paid",
    value: "38",
    delta: { value: "4.1% vs last period", positive: false },
  },
};

export const NoDelta: Story = {
  args: {
    label: "Active Channels",
    value: "3",
    sub: "2 peers connected",
  },
};
