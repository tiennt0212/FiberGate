import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { ASSETS, INVOICE_STATUSES } from "@/lib/types";
import { FilterGroup } from "./FilterGroup";

const STATUS_OPTIONS = ["all", ...Object.values(INVOICE_STATUSES)] as const;
const ASSET_OPTIONS = ["all", ...Object.values(ASSETS)] as const;

const meta = {
  title: "Components/FilterGroup",
  component: FilterGroup,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    options: STATUS_OPTIONS,
    value: "all",
    onChange: fn(),
  },
} satisfies Meta<typeof FilterGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

function StatusFilterDemo() {
  const [value, setValue] = useState<(typeof STATUS_OPTIONS)[number]>("paid");
  return (
    <FilterGroup options={STATUS_OPTIONS} value={value} onChange={setValue} />
  );
}

function AssetFilterDemo() {
  const [value, setValue] = useState<(typeof ASSET_OPTIONS)[number]>("CKB");
  return (
    <FilterGroup
      mono
      options={ASSET_OPTIONS}
      value={value}
      onChange={setValue}
    />
  );
}

export const StatusFilter: Story = {
  render: () => <StatusFilterDemo />,
};

export const AssetFilter: Story = {
  render: () => <AssetFilterDemo />,
};
