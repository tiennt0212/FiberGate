"use client";

// Experimental: lets a tester pay the current invoice from an in-browser
// Fiber wallet (runs a real Fiber node client-side via WASM,
// @nervosnetwork/fiber-js) instead of needing a separate wallet/node — added
// at the operator's explicit request to speed up manual testing of issue
// #12's payment flow. This does NOT replace the QR code (an external wallet
// scanning invoice_address is still the primary, realistic integration
// path) — it's an additional, self-contained way to pay without leaving the
// browser tab.
//
// Known caveats (not yet live-verified end-to-end as of this writing):
// - Routing still requires *some* path to FiberGate's fiber-node. This
//   wallet's WASM node can only reach P2P peers that accept WebSocket (wss)
//   connections (browsers cannot open raw TCP sockets) — fiber-node itself
//   currently has no WSS-exposed P2P (see .context/architecture/system-design.md's
//   "Merchant's storefront app cụ thể hoá" note and decisions-log.md
//   2026-07-08). A multi-hop route via a public testnet node that (a)
//   supports WSS and (b) already has a channel to fiber-node is the intended
//   path. To connect a first peer, use the *Diagnostics* tab's "Connect Peer
//   Address" field (needs a full multiaddr, not just a pubkey — first
//   contact with an unknown peer fails otherwise), then open a channel to
//   that peer's pubkey from the *Channels* tab. There is no pre-wired peer
//   here since a WSS-capable public node hasn't been identified/confirmed
//   live yet.
// - @fiber-pay/react's documented compatibility target is Fiber v0.9.0-rc4;
//   FiberGate's own fiber-node is pinned to v0.9.0-rc6. Likely compatible
//   (same wire protocol generation) but not verified against this exact
//   version pair.
//
// Bug fixed 2026-07-08: useFiberPayment's payInvoice() never throws — it
// catches every internal failure (parse error, no-route, timeout, a
// terminal "Failed" payment status) and only records it in the hook's own
// `error` state (verified by reading node_modules/.../@fiber-pay/react/dist/index.js
// directly, not assumed from the README). An earlier version of this file
// treated "the awaited call didn't throw" as success, which showed "Paid ✓"
// even when nothing was ever sent (e.g. a freshly connected wallet with 0
// peers/0 channels fails instantly at the "no path found" stage — no
// network request is made at all, since that failure never leaves the WASM
// node). The fix below only treats `paymentResult.status === "Success"` as
// success, driven by an effect watching the hook's own state — payInvoice()
// resolving is not itself a success signal.

import { FiberNodeButton, NodeInfoPanel, useFiberNode, useFiberPayment } from "@fiber-pay/react";
import type { Invoice } from "@fibergate/sdk";
import { useEffect, useState } from "react";

const WALLET_ID = "fibergate-demo-storefront";

interface BrowserWalletPayProps {
  invoice: Invoice;
}

export default function BrowserWalletPay({ invoice }: BrowserWalletPayProps) {
  const fiber = useFiberNode({ network: "testnet", walletId: WALLET_ID });
  const { payInvoice, isPaying, paymentResult, error: payError } = useFiberPayment(fiber.node);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (paymentResult?.status === "Success") {
      setPaid(true);
    }
  }, [paymentResult]);

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #333" }}>
      <p style={{ fontSize: "0.8em", opacity: 0.7 }}>
        Experimental — pay from a wallet running in this browser tab (no external app needed).
        First time here: connect, fund the CKB address below with testnet CKB, then use the
        Diagnostics tab to connect a peer and the Channels tab to open a route to this node before
        paying — see the source comment at the top of this component for the exact steps.
      </p>
      <FiberNodeButton fiber={fiber} strategy="passkey" />
      {fiber.isRunning && (
        <>
          <NodeInfoPanel node={fiber.node} network="testnet" showQrCode />
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                setPaid(false);
                void payInvoice(invoice.invoice_address);
              }}
              disabled={isPaying || paid}
              type="button"
            >
              {isPaying ? "Paying…" : paid ? "Paid ✓" : "Pay this invoice"}
            </button>
            {payError && <p style={{ color: "#e0554f" }}>{payError}</p>}
          </div>
        </>
      )}
    </div>
  );
}
