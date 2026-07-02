"use client";

import { Button, Card, Checkbox, Form, Input } from "antd";
import { WEBHOOK_EVENTS } from "@/lib/types";

const EVENT_OPTIONS = [
  { label: "payment.paid", value: WEBHOOK_EVENTS.PAYMENT_PAID },
  { label: "invoice.expired", value: WEBHOOK_EVENTS.INVOICE_EXPIRED },
  { label: "invoice.failed", value: WEBHOOK_EVENTS.INVOICE_FAILED },
];

// UI-only form — onSubmit just closes it in this pure-UI build.
export function WebhookForm({ onCancel }: { onCancel: () => void }) {
  return (
    <Card
      title="New Webhook Endpoint"
      styles={{ header: { fontSize: 13.5, fontWeight: 600, minHeight: 44 } }}
    >
      <Form layout="vertical" requiredMark={false} onFinish={onCancel}>
        <Form.Item
          label="Endpoint URL"
          name="url"
          rules={[
            { required: true, message: "URL is required" },
            { type: "url", message: "Must be a valid URL" },
          ]}
        >
          <Input placeholder="https://your-shop.com/api/fibergate/webhook" />
        </Form.Item>
        <Form.Item
          label="Events"
          name="events"
          initialValue={[WEBHOOK_EVENTS.PAYMENT_PAID]}
          rules={[{ required: true, message: "Select at least one event" }]}
        >
          <Checkbox.Group options={EVENT_OPTIONS} />
        </Form.Item>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit">
            Add endpoint
          </Button>
        </div>
      </Form>
    </Card>
  );
}
