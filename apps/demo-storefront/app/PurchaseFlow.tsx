"use client";

import type { Invoice } from "@fibergate/sdk";
import dynamic from "next/dynamic";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";

import { createDemoInvoice } from "./actions";

// Code-split + no-SSR: this pulls in @fiber-pay/react's ~14MB WASM runtime
// (browser-only, can't run during server render). next/dynamic only fetches
// the chunk once <BrowserWalletPay> actually renders — gated below behind a
// button click, not rendered unconditionally, so a normal page load never
// downloads it (see BrowserWalletPay.tsx's own header comment for why this
// exists and its known caveats).
const BrowserWalletPay = dynamic(() => import("./BrowserWalletPay"), {
  ssr: false,
  loading: () => <p>Loading browser wallet…</p>,
});

type TerminalStatus = "paid" | "expired" | "failed";

type FlowState =
  | { phase: "idle" }
  | { phase: "creating" }
  | { phase: "awaiting_payment"; invoice: Invoice }
  | { phase: TerminalStatus; invoice: Invoice }
  | { phase: "error"; message: string };

interface WebhookBusEvent {
  invoiceId: string;
  status: TerminalStatus;
}

export function PurchaseFlow() {
  const [state, setState] = useState<FlowState>({ phase: "idle" });
  const [showBrowserWallet, setShowBrowserWallet] = useState(false);

  // Opens exactly once per invoice (entering "awaiting_payment") and closes
  // on leaving it — the real-time update mechanism (issue #12): a genuine
  // webhook receipt (app/api/webhook/route.ts) pushes through this stream
  // (app/api/webhook-events/[invoiceId]/route.ts), no polling loop.
  useEffect(() => {
    if (state.phase !== "awaiting_payment") {
      return;
    }
    const { invoice } = state;
    const source = new EventSource(`/api/webhook-events/${invoice.id}`);

    source.onmessage = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as WebhookBusEvent;
        if (event.invoiceId === invoice.id) {
          setState({ phase: event.status, invoice });
        }
      } catch {
        // Heartbeat comment frames (": heartbeat") never reach onmessage;
        // anything else malformed here is simply ignored.
      }
    };

    return () => source.close();
  }, [state]);

  async function handleBuy() {
    setState({ phase: "creating" });
    try {
      const invoice = await createDemoInvoice();
      setState({ phase: "awaiting_payment", invoice });
    } catch (error) {
      setState({ phase: "error", message: error instanceof Error ? error.message : "Unknown error" });
    }
  }

  switch (state.phase) {
    case "idle":
      return (
        <button onClick={handleBuy} type="button">
          Buy now
        </button>
      );

    case "creating":
      return <p>Creating invoice…</p>;

    case "error":
      return (
        <div>
          <p>Something went wrong: {state.message}</p>
          <button onClick={handleBuy} type="button">
            Try again
          </button>
        </div>
      );

    case "paid":
      return <p>✅ Payment received. Thanks!</p>;

    case "expired":
      return (
        <div>
          <p>⌛ Invoice expired before payment arrived.</p>
          <button onClick={handleBuy} type="button">
            Try again
          </button>
        </div>
      );

    case "failed":
      return (
        <div>
          <p>❌ Payment failed.</p>
          <button onClick={handleBuy} type="button">
            Try again
          </button>
        </div>
      );

    case "awaiting_payment": {
      const { invoice } = state;
      return (
        <div>
          <QRCodeSVG value={invoice.invoice_address} size={220} />
          <p>
            {invoice.amount} {invoice.asset}
          </p>
          <p style={{ wordBreak: "break-all", fontFamily: "monospace", fontSize: "0.85em" }}>
            {invoice.invoice_address}
          </p>
          <ExpiryCountdown expiresAt={invoice.expires_at} />

          {showBrowserWallet ? (
            <BrowserWalletPay invoice={invoice} />
          ) : (
            <button onClick={() => setShowBrowserWallet(true)} type="button" style={{ marginTop: 16 }}>
              Pay with browser wallet (experimental)
            </button>
          )}
        </div>
      );
    }
  }
}

/** UX fallback only — correctness comes from the SSE/webhook path above, not this. */
function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const target = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = Math.max(0, target - now);
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);

  return (
    <p>
      Expires in {minutes}:{seconds.toString().padStart(2, "0")}
    </p>
  );
}
