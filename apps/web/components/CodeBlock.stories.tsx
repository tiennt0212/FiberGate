import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CodeBlock } from "./CodeBlock";

const meta = {
  title: "Components/CodeBlock",
  component: CodeBlock,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[520px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: `curl -X POST http://localhost:3000/api/v1/invoices \\
  -H "Authorization: Bearer $FIBERGATE_INTERNAL_SECRET" \\
  -d '{ "amount": 125.5, "asset": "CKB" }'`,
  },
};
