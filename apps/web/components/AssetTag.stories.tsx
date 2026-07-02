import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ASSETS } from "@/lib/types";
import { AssetTag } from "./AssetTag";

const meta = {
  title: "Components/AssetTag",
  component: AssetTag,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    asset: { control: "select", options: Object.values(ASSETS) },
  },
} satisfies Meta<typeof AssetTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CKB: Story = {
  args: { asset: "CKB" },
};

export const AllAssets: Story = {
  args: { asset: "CKB" },
  render: () => (
    <div className="flex items-center gap-2.5">
      {Object.values(ASSETS).map((asset) => (
        <AssetTag key={asset} asset={asset} />
      ))}
    </div>
  ),
};
