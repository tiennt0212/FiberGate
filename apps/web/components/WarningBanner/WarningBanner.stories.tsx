import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { WarningBanner } from "./WarningBanner";

const meta = {
  title: "Components/WarningBanner",
  component: WarningBanner,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[520px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WarningBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Treat API keys like passwords",
    description: (
      <>
        Secret keys are only shown <strong>once</strong> at creation. Use
        environment variables — never commit keys to source control.
      </>
    ),
  },
};

export const TitleOnly: Story = {
  args: {
    title: "Inbound capacity is below 10 CKB",
  },
};
