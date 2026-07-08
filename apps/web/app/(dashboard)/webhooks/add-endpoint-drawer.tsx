"use client";

import { useState } from "react";
import { Button, Drawer } from "antd";

import { WebhookEvent } from "@/lib/webhooks/events";

import { createEndpoint, type EndpointView } from "./actions";

// Colocated with webhooks-panel.tsx (its only caller) per
// frontend-exp's component-split-large. No "* all events" checkbox: the
// mockup has one, but lib/webhooks/trigger.ts's triggerWebhook() matches
// endpoints via `endpoint.events.includes(eventType)` with no wildcard
// special-case — storing a literal "*" would silently never match a real
// event, so only the 3 real WebhookEvent values are offered. Imported from
// lib/webhooks/events.ts (not lib/webhooks/trigger.ts, which pulls in
// @/lib/db + node:crypto transitively — fatal for a "use client" bundle).

const EVENT_OPTIONS: { value: string; title: string; description: string }[] = [
  { value: WebhookEvent.PaymentPaid, title: "payment.paid", description: "Invoice successfully paid" },
  { value: WebhookEvent.InvoiceExpired, title: "invoice.expired", description: "Invoice expired without payment" },
  { value: WebhookEvent.InvoiceFailed, title: "invoice.failed", description: "Payment failure or rejection" },
];

export function AddEndpointDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (endpoint: EndpointView, secret: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([WebhookEvent.PaymentPaid, WebhookEvent.InvoiceExpired]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleEvent(value: string): void {
    setEvents((prev) => (prev.includes(value) ? prev.filter((event) => event !== value) : [...prev, value]));
  }

  function reset(): void {
    setUrl("");
    setEvents([WebhookEvent.PaymentPaid, WebhookEvent.InvoiceExpired]);
    setError(null);
  }

  function handleSubmit(): void {
    setSubmitting(true);
    setError(null);
    createEndpoint(url, events)
      .then((result) => {
        if (result.ok && result.endpoint && result.secret) {
          onCreated(result.endpoint, result.secret);
          reset();
        } else {
          setError(result.error ?? "Could not create the endpoint.");
        }
      })
      .catch((submitError: unknown) => {
        console.error("AddEndpointDrawer: createEndpoint failed:", submitError);
        setError("Could not create the endpoint.");
      })
      .finally(() => setSubmitting(false));
  }

  return (
    <Drawer
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      width={480}
      title="Add Webhook Endpoint"
      styles={{ header: { padding: "20px 24px 16px", borderBottom: "1px solid var(--color-border-subtle)"}, body: { padding: "24px" } }}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} className="h-auto! rounded-md! px-4! py-2!">
            Cancel
          </Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={handleSubmit}
            className="h-auto! rounded-md! bg-accent! px-4! py-2! hover:bg-accent-hover!"
          >
            Add Endpoint
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4.5">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-text-strong">Endpoint URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourdomain.com/webhooks/fibergate"
            className="w-full rounded-md border border-border px-2.5 py-2 font-mono text-[13px] text-text-primary outline-none"
          />
          {error ? <div className="mt-1.5 text-[12px] text-danger">{error}</div> : <div className="mt-1.5 text-[12px] text-text-subtle">Must be a publicly reachable HTTPS URL.</div>}
        </div>
        <div>
          <label className="mb-2 block text-[12px] font-medium text-text-strong">Events to listen for</label>
          <div className="flex flex-col gap-1.5">
            {EVENT_OPTIONS.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={events.includes(option.value)}
                  onChange={() => toggleEvent(option.value)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-accent"
                />
                <div>
                  <div className="text-[13px] font-medium text-text-primary">{option.title}</div>
                  <div className="mt-0.5 text-[12px] text-text-muted">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
