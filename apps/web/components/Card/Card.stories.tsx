import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Card } from "./Card";

const meta = {
  title: "Components/Card",
  component: Card,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="w-[260px]">
        <div className="text-caption font-semibold uppercase tracking-wide text-text-xsubtle">
          Total Volume (30d)
        </div>
        <div className="mt-2.5 text-display font-bold leading-none text-text-primary">
          12,450 CKB
        </div>
        <div className="mt-1 text-label text-text-subtle">+ 142 RUSD</div>
      </div>
    ),
  },
};

export const WithTitle: Story = {
  args: {
    title: "Recent Invoices",
    children: (
      <p className="m-0 text-body text-text-secondary">
        Card content goes here.
      </p>
    ),
  },
};
