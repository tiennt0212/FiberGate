"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Checkbox, Input, Modal, Popconfirm, Switch, Typography } from "antd";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  retryWebhookDelivery,
  setWebhookActive,
} from "@/lib/dashboard/actions";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime, shortId, truncateMiddle } from "@/lib/format";

export interface EndpointDTO {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  totalDeliveries: number;
  successDeliveries: number;
  lastDeliveryAt: string | null;
}

export interface DeliveryDTO {
  id: string;
  endpointId: string;
  invoiceId: string;
  eventType: string;
  httpStatus: number | null;
  status: string;
  attemptCount: number;
  createdAt: string;
  deliveredAt: string | null;
}

const EVENT_OPTIONS = ["payment.paid", "invoice.expired", "invoice.failed", "*"];

export function WebhooksClient({
  endpoints,
  deliveries,
}: {
  endpoints: EndpointDTO[];
  deliveries: DeliveryDTO[];
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [pending, startTransition] = useTransition();

  const [selectedId, setSelectedId] = useState<string | null>(endpoints[0]?.id ?? null);
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["payment.paid", "invoice.expired"]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const selectedDeliveries = deliveries.filter((d) => d.endpointId === selectedId);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function onCreate() {
    const res = await createWebhookEndpoint({ url, events });
    if (!res.ok) {
      message.error(res.error ?? "Failed to add endpoint");
      return;
    }
    setRevealedSecret(res.secret ?? null);
    setUrl("");
    setEvents(["payment.paid", "invoice.expired"]);
    setShowForm(false);
    if (res.id) setSelectedId(res.id);
    refresh();
  }

  async function onToggle(id: string, active: boolean) {
    await setWebhookActive(id, active);
    refresh();
  }

  async function onDelete(id: string) {
    await deleteWebhookEndpoint(id);
    if (selectedId === id) setSelectedId(null);
    refresh();
  }

  async function onRetry(id: string) {
    const res = await retryWebhookDelivery(id);
    message[res.ok ? "success" : "error"](res.ok ? "Retry queued" : "Retry failed");
    refresh();
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-[18px] flex items-center justify-between">
        <div className="text-[12.5px] text-muted">
          Real-time event notifications sent to your endpoints
        </div>
        <Button type="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add endpoint"}
        </Button>
      </div>

      {showForm && (
        <div className="mb-[14px] animate-fade-in rounded-lg border border-[#c7d2fe] bg-surface p-5">
          <div className="mb-4 text-[13.5px] font-semibold text-ink">New Webhook Endpoint</div>
          <div className="mb-4 flex flex-col gap-3">
            <div>
              <label className="mb-[5px] block text-[12px] font-medium text-[#374151]">
                Endpoint URL
              </label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourdomain.com/webhooks/fibergate"
                className="font-mono"
              />
            </div>
            <div>
              <label className="mb-2 block text-[12px] font-medium text-[#374151]">
                Events to listen for
              </label>
              <Checkbox.Group
                options={EVENT_OPTIONS.map((e) => ({ label: e, value: e }))}
                value={events}
                onChange={(v) => setEvents(v as string[])}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="primary" onClick={onCreate} loading={pending}>
              Add Endpoint
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-[14px]">
        {/* Endpoints */}
        <div className="self-start overflow-hidden rounded-lg border border-border bg-surface">
          <div className="border-b border-border-subtle px-[18px] py-[14px] text-[13px] font-semibold text-ink">
            Endpoints
          </div>
          {endpoints.length === 0 ? (
            <div className="px-[18px] py-8 text-center text-[13px] text-subtle">
              No endpoints yet. Add one to start receiving events.
            </div>
          ) : (
            endpoints.map((wh) => {
              const rate =
                wh.totalDeliveries === 0
                  ? "—"
                  : `${Math.round((wh.successDeliveries / wh.totalDeliveries) * 100)}%`;
              return (
                <div
                  key={wh.id}
                  onClick={() => setSelectedId(wh.id)}
                  className="cursor-pointer border-b border-border-subtle px-[18px] py-[14px] hover:bg-[#f9f9fb]"
                  style={{
                    background: selectedId === wh.id ? "#f9f9fb" : undefined,
                    borderLeft: `2px solid ${selectedId === wh.id ? "#4f46e5" : "transparent"}`,
                  }}
                >
                  <div className="mb-[6px] flex items-start justify-between gap-[10px]">
                    <code className="flex-1 break-all font-mono text-[12px] leading-snug text-ink">
                      {wh.url}
                    </code>
                    <StatusBadge status={wh.isActive ? "active" : "disabled"} />
                  </div>
                  <div className="mb-[5px] text-[11.5px] text-muted">{wh.events.join(", ")}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] text-subtle">
                      Last: {formatDateTime(wh.lastDeliveryAt)}
                    </span>
                    <div
                      className="flex items-center gap-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[11.5px] text-subtle">{rate} success</span>
                      <Switch
                        size="small"
                        checked={wh.isActive}
                        onChange={(v) => onToggle(wh.id, v)}
                      />
                      <Popconfirm title="Delete this endpoint?" onConfirm={() => onDelete(wh.id)}>
                        <Button size="small" danger type="text">
                          Delete
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Delivery history */}
        <div className="self-start overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border-subtle px-[18px] py-[14px]">
            <span className="text-[13px] font-semibold text-ink">Delivery History</span>
            <span className="max-w-[200px] truncate font-mono text-[12px] text-muted">
              {selectedId ? endpoints.find((e) => e.id === selectedId)?.url : ""}
            </span>
          </div>
          {selectedDeliveries.length === 0 ? (
            <div className="px-[18px] py-8 text-center text-[13px] text-subtle">
              No deliveries yet for this endpoint.
            </div>
          ) : (
            selectedDeliveries.map((dl) => (
              <div
                key={dl.id}
                className="flex items-center gap-3 border-b border-border-subtle px-[18px] py-[11px]"
              >
                <span
                  className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                  style={{ background: dotColor(dl.status) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[12px] text-ink">{dl.eventType}</div>
                  <div className="mt-[2px] text-[11.5px] text-subtle">
                    {shortId(dl.invoiceId)} · {formatDateTime(dl.createdAt)} · attempt {dl.attemptCount}
                  </div>
                </div>
                <span
                  className="font-mono text-[12px] font-semibold"
                  style={{ color: httpColor(dl.httpStatus) }}
                >
                  {dl.httpStatus ?? "—"}
                </span>
                {dl.status === "failed" && dl.attemptCount < 3 && (
                  <Button size="small" onClick={() => onRetry(dl.id)}>
                    Retry
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        open={revealedSecret !== null}
        onCancel={() => setRevealedSecret(null)}
        title="Webhook secret"
        footer={[
          <Button key="ok" type="primary" onClick={() => setRevealedSecret(null)}>
            Done
          </Button>,
        ]}
      >
        <p className="text-[13px] text-muted">
          Copy this secret now — it is shown once and stored encrypted. Use it to verify the{" "}
          <code className="font-mono">X-Fiber-Signature</code> header.
        </p>
        <Typography.Paragraph
          copyable={{ text: revealedSecret ?? "" }}
          className="mt-2 break-all rounded bg-border-subtle px-3 py-2 font-mono text-[12px]"
        >
          {revealedSecret ? truncateMiddle(revealedSecret, 20, 12) : ""}
        </Typography.Paragraph>
      </Modal>
    </div>
  );
}

function dotColor(status: string): string {
  if (status === "success") return "#16a34a";
  if (status === "failed") return "#dc2626";
  return "#f59e0b";
}

function httpColor(code: number | null): string {
  if (code == null) return "#71717a";
  if (code >= 200 && code < 300) return "#15803d";
  return "#991b1b";
}
