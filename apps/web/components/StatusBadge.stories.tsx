import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatusBadge } from "./StatusBadge";

const STATUSES = [
  "paid",
  "pending",
  "expired",
  "failed",
  "active",
  "disabled",
] as const;

const meta = {
  title: "Components/StatusBadge",
  component: StatusBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    status: { control: "select", options: STATUSES },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Paid: Story = {
  args: { status: "paid" },
};

export const AllStatuses: Story = {
  args: { status: "paid" },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {STATUSES.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};
