import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Input, Checkbox } from "antd";

import { WEBHOOK_EVENTS } from "@/lib/types";
import { Button } from "@/components/Button/Button";
import { Modal } from "./Modal";

const meta = {
  title: "Components/Modal",
  component: Modal,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    title: "New Webhook Endpoint",
    onCancel: fn(),
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

const formContent = (
  <div className="flex flex-col gap-3">
    <div>
      <label className="mb-1 block text-label font-medium text-text-secondary">
        Endpoint URL
      </label>
      <Input
        className="font-mono"
        placeholder="https://yourdomain.com/webhooks/…"
      />
    </div>
    <div>
      <label className="mb-2 block text-label font-medium text-text-secondary">
        Events
      </label>
      <div className="flex flex-wrap gap-1.5">
        {Object.values(WEBHOOK_EVENTS).map((event) => (
          <Checkbox key={event} defaultChecked={event === "payment.paid"}>
            <span className="text-label">{event}</span>
          </Checkbox>
        ))}
      </div>
    </div>
  </div>
);

function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Open Modal
      </Button>
      <Modal
        open={open}
        title="New Webhook Endpoint"
        onCancel={() => setOpen(false)}
        footer={[
          <Button key="cancel" variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>,
          <Button key="ok" variant="primary" onClick={() => setOpen(false)}>
            Add Endpoint
          </Button>,
        ]}
      >
        {formContent}
      </Modal>
    </>
  );
}

export const Default: Story = {
  render: () => <ModalDemo />,
};
