import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CapacityBar } from "./CapacityBar";

const meta = {
  title: "Components/CapacityBar",
  component: CapacityBar,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[280px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CapacityBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inbound: Story = {
  args: {
    label: "Inbound",
    value: "45,200 CKB",
    percent: 72,
    direction: "inbound",
    caption: "72% of capacity",
  },
};

export const Outbound: Story = {
  args: {
    label: "Outbound",
    value: "18,500 CKB",
    percent: 30,
    direction: "outbound",
    caption: "30% of capacity",
  },
};

export const Stacked: Story = {
  args: Inbound.args!,
  render: () => (
    <div className="flex flex-col gap-3.5">
      <CapacityBar {...Inbound.args!} />
      <CapacityBar {...Outbound.args!} />
    </div>
  ),
};
