"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, message } from "antd";

import type { WebhookDeliveryHealth } from "@/lib/services/webhooks";

import { deliveryHttpText, deliveryStatusColor, StatusTag } from "../badges";
import type { DeliveryView } from "../delivery-view";
import { formatDateTime } from "../format-date";
import { useHeaderActionContext } from "../header-action-context";
import { StatCard } from "../stat-card";
import { useBusyKeys } from "../use-busy-keys";

import { getEndpointDeliveries, regenerateSecret, toggleEndpointActive, type EndpointView } from "./actions";
import { AddEndpointDrawer } from "./add-endpoint-drawer";

const SECRET_MASK = "whsec_" + "•".repeat(26);

function NeedsAttentionCard({ worstEndpoint }: { worstEndpoint: NonNullable<WebhookDeliveryHealth["worstEndpoint"]> }) {
  return (
    <div className="rounded-lg border border-status-degraded-border bg-status-degraded-bg px-5 py-4">
      <div className="mb-2.25 flex items-center gap-1.5">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--color-warning-banner-icon)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 1.5L12 11H1z" />
          <line x1="6.5" y1="5" x2="6.5" y2="7.8" />
          <circle cx="6.5" cy="9.3" r="0.5" fill="var(--color-warning-banner-icon)" stroke="none" />
        </svg>
        <span className="text-[11.5px] font-semibold uppercase tracking-wider text-warning-banner-title">Needs Attention</span>
      </div>
      <div className="mb-1 text-[22px] font-bold leading-none text-warning-banner-title">{worstEndpoint.failurePct}% fail rate</div>
      <div className="truncate font-mono text-[12px] text-warning-banner-body">{worstEndpoint.endpointUrl}</div>
    </div>
  );
}

export function WebhooksPanel({
  initialEndpoints,
  error,
  health,
}: {
  initialEndpoints: EndpointView[];
  error: string | null;
  health: WebhookDeliveryHealth | null;
}) {
  const router = useRouter();
  const { setAction } = useHeaderActionContext();
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [selectedId, setSelectedId] = useState<string | null>(initialEndpoints[0]?.id ?? null);
  const [deliveries, setDeliveries] = useState<DeliveryView[]>([]);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; secret: string } | null>(null);
  // Keyed as `action:endpointId`, not a single shared value, so concurrent
  // actions on different endpoints — or a toggle and a regenerate on the
  // same endpoint — don't clobber each other's loading indicator either at
  // click time or when one promise settles before the other. Shared with
  // delivery-log-table.tsx's retry-button tracking via useBusyKeys().
  const busyKeys = useBusyKeys();

  useEffect(() => {
    setEndpoints(initialEndpoints);
    setSelectedId((current) => current ?? initialEndpoints[0]?.id ?? null);
  }, [initialEndpoints]);

  // BR-SEC-003 / one-time-reveal contract: a previously revealed plaintext
  // secret must never be shown again after the user navigates away (selects
  // a different endpoint, or the same one again) and back. Cleared here
  // rather than in a useEffect keyed on selectedId, because the creation
  // flow (onCreated below) intentionally sets selectedId and revealedSecret
  // together in the same handler — an effect keyed on selectedId would fire
  // after that render and immediately wipe the just-created secret.
  function handleSelect(id: string): void {
    if (id !== selectedId) {
      setRevealedSecret(null);
    }
    setSelectedId(id);
  }

  useEffect(() => {
    if (!selectedId) {
      setDeliveries([]);
      return;
    }
    let cancelled = false;
    getEndpointDeliveries(selectedId)
      .then((rows) => {
        if (!cancelled) setDeliveries(rows);
      })
      .catch((fetchError: unknown) => console.error("Webhooks: getEndpointDeliveries failed:", fetchError));
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    setAction({ label: "Add Endpoint", onClick: () => setShowAddDrawer(true) });
    return () => setAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleToggle(endpoint: EndpointView): void {
    const key = `toggle:${endpoint.id}`;
    if (!busyKeys.start(key)) return;
    toggleEndpointActive(endpoint.id, !endpoint.isActive)
      .then((result) => {
        if (result.ok) {
          setEndpoints((prev) => prev.map((e) => (e.id === endpoint.id ? { ...e, isActive: !endpoint.isActive } : e)));
          router.refresh();
        } else {
          void message.error(result.error ?? "Could not update the endpoint.");
        }
      })
      .catch((toggleError: unknown) => {
        console.error("Webhooks: toggleEndpointActive failed:", toggleError);
        void message.error("Could not update the endpoint.");
      })
      .finally(() => busyKeys.settle(key));
  }

  function handleRegenerate(): void {
    if (!selectedId) return;
    const key = `regenerate:${selectedId}`;
    if (!busyKeys.start(key)) return;
    regenerateSecret(selectedId)
      .then((result) => {
        if (result.ok && result.secret) {
          setRevealedSecret({ id: selectedId, secret: result.secret });
        } else {
          void message.error(result.error ?? "Could not regenerate the secret.");
        }
      })
      .catch((regenError: unknown) => {
        console.error("Webhooks: regenerateSecret failed:", regenError);
        void message.error("Could not regenerate the secret.");
      })
      .finally(() => busyKeys.settle(key));
  }

  const selectedEndpoint = endpoints.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="animate-[fade-in_0.2s_ease-out_forwards]">
      <div className="mb-5.5 text-[12.5px] text-text-muted">Real-time event notifications sent to your endpoints</div>

      {error ? <Alert type="error" showIcon message={error} className="mb-4 rounded-md!" /> : null}

      {health ? (
        <div className="mb-3.5 grid grid-cols-2 gap-3.5">
          <StatCard
            label="Delivery Success Rate"
            value={health.successRatePct !== null ? `${health.successRatePct}%` : "—"}
            sub={health.resolvedCount > 0 ? `${health.resolvedCount} delivered · 24h` : "No deliveries in the last 24h"}
            size="md"
          />
          {health.worstEndpoint ? <NeedsAttentionCard worstEndpoint={health.worstEndpoint} /> : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3.5">
        <div className="self-start overflow-hidden rounded-lg border border-border bg-white">
          <div className="border-b border-border-subtle px-4.5 py-3.5 text-[13px] font-semibold text-text-primary">Endpoints</div>
          {endpoints.length === 0 ? (
            <div className="px-4.5 py-10 text-center text-[13px] text-text-subtle">No endpoints yet. Add one to start receiving events.</div>
          ) : (
            endpoints.map((endpoint) => (
              <div
                key={endpoint.id}
                onClick={() => handleSelect(endpoint.id)}
                className={`cursor-pointer border-b border-border-subtle border-l-2 px-4.5 py-3.5 last:border-b-0 hover:bg-table-header-bg ${
                  selectedId === endpoint.id ? "border-l-accent-border bg-[#f0f0ff]" : "border-l-transparent"
                }`}
              >
                <div className="mb-1.5 flex items-start justify-between gap-2.5">
                  <code className="flex-1 break-all font-mono text-[12px] leading-snug text-text-primary">{endpoint.url}</code>
                  <StatusTag status={endpoint.isActive ? "active" : "disabled"} />
                </div>
                <div className="mb-2 text-[11.5px] text-text-muted">{endpoint.events.join(", ")}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] text-text-subtle">{endpoint.createdAt ? `Created ${formatDateTime(endpoint.createdAt)}` : ""}</span>
                  <Button
                    size="small"
                    loading={busyKeys.has(`toggle:${endpoint.id}`)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(endpoint);
                    }}
                    className="h-auto! rounded-sm! px-2! py-0.5! text-[11px]!"
                  >
                    {endpoint.isActive ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="overflow-hidden rounded-lg border border-border bg-white">
            <div className="flex items-center justify-between border-b border-border-subtle px-4.5 py-3.5">
              <span className="text-[13px] font-semibold text-text-primary">Delivery History</span>
              <span className="max-w-50 truncate font-mono text-[12px] text-text-muted">{selectedEndpoint?.url ?? ""}</span>
            </div>
            {deliveries.length > 0 ? (
              deliveries.map((delivery) => (
                <div key={delivery.id} className="flex items-center gap-3 border-b border-border-subtle px-4.5 py-2.75 last:border-b-0">
                  <div
                    className="h-1.75 w-1.75 shrink-0 rounded-full"
                    style={{ backgroundColor: deliveryStatusColor(delivery.status).dot }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[12px] text-text-primary">{delivery.eventType}</div>
                    <div className="mt-0.5 text-[11.5px] text-text-subtle">{formatDateTime(delivery.deliveredAt ?? delivery.createdAt)}</div>
                  </div>
                  <span className="font-mono text-[12px] font-semibold text-text-muted">
                    {deliveryHttpText(delivery)}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4.5 py-8 text-center text-[13px] text-text-subtle">No deliveries yet for this endpoint.</div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-white px-4.5 py-4">
            <div className="mb-2.5 text-[13px] font-semibold text-text-primary">Signing Secret</div>
            <div className="mb-2.5 text-[12px] leading-relaxed text-text-muted">Use this secret to verify webhook payloads with HMAC-SHA256 (BR-WHK-004).</div>
            {revealedSecret && revealedSecret.id === selectedId ? (
              <>
                <Alert
                  type="warning"
                  showIcon
                  message="Copy this now — it will not be shown again"
                  className="mb-2 rounded-md!"
                />
                <div className="flex items-center gap-2">
                  <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-[5px] bg-border-subtle px-2.5 py-2 font-mono text-[12px] text-text-strong">
                    {revealedSecret.secret}
                  </div>
                  <Button
                    onClick={() => {
                      navigator.clipboard
                        .writeText(revealedSecret.secret)
                        .then(() => message.success("Secret copied"))
                        .catch((copyError: unknown) => console.error("Failed to copy secret:", copyError));
                    }}
                    className="h-auto! whitespace-nowrap rounded-[5px]! px-2.5! py-1.5!"
                  >
                    Copy
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-[5px] bg-border-subtle px-2.5 py-2 font-mono text-[12px] text-text-strong">
                  {SECRET_MASK}
                </div>
                <Button
                  disabled={!selectedEndpoint}
                  loading={selectedId !== null && busyKeys.has(`regenerate:${selectedId}`)}
                  onClick={handleRegenerate}
                  className="h-auto! whitespace-nowrap rounded-[5px]! px-2.5! py-1.5!"
                >
                  Regenerate
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddEndpointDrawer
        open={showAddDrawer}
        onClose={() => setShowAddDrawer(false)}
        onCreated={(endpoint, secret) => {
          setEndpoints((prev) => [endpoint, ...prev]);
          setSelectedId(endpoint.id);
          setRevealedSecret({ id: endpoint.id, secret });
          setShowAddDrawer(false);
          router.refresh();
        }}
      />
    </div>
  );
}
