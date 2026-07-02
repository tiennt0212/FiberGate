import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { PlusOutlined, FileTextOutlined } from "@ant-design/icons";

import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "danger"],
    },
  },
  args: { onClick: fn() },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: "primary",
    icon: <PlusOutlined />,
    children: "Create Invoice",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Cancel",
  },
};

export const Danger: Story = {
  args: {
    variant: "danger",
    children: "Revoke",
  },
};

export const TableRowActions: Story = {
  render: (args) => (
    <div className="flex items-center gap-2.5">
      <Button {...args} variant="danger">
        Revoke
      </Button>
      <Button {...args} variant="secondary" size="small" icon={<FileTextOutlined />}>
        Receipt
      </Button>
    </div>
  ),
};
