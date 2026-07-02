"use client";

import { useState } from "react";
import { Button, Card } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { webhookDeliveries, webhookEndpoints } from "@/lib/mock/data";
import { StatusBadge } from "@/components/StatusBadge";
import { DeliveryLog } from "./DeliveryLog";
import { WebhookForm } from "./WebhookForm";

export default function WebhooksPage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(webhookEndpoints[0]?.id ?? null);

  const deliveries = webhookDeliveries.filter(
    (d) => d.endpoint_id === selectedId,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="m-0 text-[13px] text-text-secondary">
          Merchant endpoints notified when invoice status changes.
        </p>
        {!showForm && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowForm(true)}
          >
            Add endpoint
          </Button>
        )}
      </div>

      {showForm && <WebhookForm onCancel={() => setShowForm(false)} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Endpoints list */}
        <div className="lg:col-span-2">
          <Card
            title="Endpoints"
            styles={{
              body: { padding: 0 },
              header: { fontSize: 13.5, fontWeight: 600, minHeight: 44 },
            }}
          >
            {webhookEndpoints.map((wh) => {
              const active = wh.id === selectedId;
              return (
                <button
                  key={wh.id}
                  onClick={() => setSelectedId(wh.id)}
                  className="flex w-full flex-col gap-1.5 border-b border-border-subtle px-4 py-3.5 text-left last:border-b-0 hover:bg-row-hover"
                  style={{
                    background: active ? "var(--row-hover)" : undefined,
                    borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-[12px] text-text-primary">
                      {wh.url}
                    </span>
                    <StatusBadge status={wh.is_active ? "active" : "disabled"} />
                  </div>
                  <span className="text-[11.5px] text-text-subtle">
                    {wh.events.join(", ")}
                  </span>
                </button>
              );
            })}
          </Card>
        </div>

        {/* Delivery log */}
        <div className="lg:col-span-3">
          <Card
            title="Webhook Delivery Log"
            styles={{
              body: { padding: 0 },
              header: { fontSize: 13.5, fontWeight: 600, minHeight: 44 },
            }}
          >
            <DeliveryLog deliveries={deliveries} />
          </Card>
        </div>
      </div>
    </div>
  );
}
