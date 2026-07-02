import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { invoices } from "@/lib/mock/data";
import { InvoiceTable } from "./InvoiceTable";

const meta = {
  title: "Components/InvoiceTable",
  component: InvoiceTable,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: { invoices },
} satisfies Meta<typeof InvoiceTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithReceiptAction: Story = {
  args: { onReceipt: fn() },
};

export const Empty: Story = {
  args: { invoices: [] },
};
