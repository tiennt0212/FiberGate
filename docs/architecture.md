# Architecture

## Overview

```mermaid
flowchart TB
    subgraph VPS["Docker Compose (merchant's own server)"]
        SF["Merchant's storefront app<br/>(outside the compose network, or joined to it)"]
        subgraph Core["fibergate-core (Next.js)"]
            Dash["Dashboard<br/>(single-admin)"]
            API["API /api/v1/*<br/>POST /invoices · GET /invoices/:id · GET /node/info"]
        end
        DB[("PostgreSQL<br/>invoices · webhook_* · node_snapshots")]
        Node["Fiber Node (FNN binary)<br/>JSON-RPC :8227 · P2P :8228<br/>Connected to testnet"]

        SF -->|"Bearer FIBERGATE_INTERNAL_SECRET"| API
        API --> DB
        API --> Node
        Dash --> DB
        Dash --> Node
    end
```

Everything above talks over the Docker internal network — nothing is publicly
exposed except through the optional `nginx` TLS/WSS reverse proxy (see
[Public HTTPS deploy](/merchants/public-https-deploy)).

## Data flow — creating an invoice

```mermaid
sequenceDiagram
    participant SF as Storefront app
    participant API as FiberGate API<br/>(/api/v1/invoices)
    participant Node as Fiber Node (RPC)
    participant DB as PostgreSQL

    SF->>API: POST /invoices {amount, asset, description}<br/>Authorization: Bearer FIBERGATE_INTERNAL_SECRET
    API->>API: constant-time compare of Bearer token<br/>(single-tenant, no per-user lookup)
    API->>Node: new_invoice {amount_in_shannon, asset, description}
    Node-->>API: {invoice_address, payment_hash}
    API->>DB: INSERT invoice (status="pending")
    API-->>SF: 201 Created {invoice}
```

## Data flow — detecting a status change

Once created, an invoice's status is picked up by one of two mechanisms running in
parallel — a real-time listener (primary) and a polling fallback (never fully
disabled):

```mermaid
sequenceDiagram
    participant Node as Fiber Node
    participant Listener as Real-time listener<br/>(WebSocket subscription — primary)
    participant Poller as Interval poller<br/>(every 30s — fallback)
    participant DB as PostgreSQL

    Node--)Listener: WS notification: invoice status changed<br/>{payment_hash, invoice_status}
    Listener->>DB: update status → paid/expired/failed

    loop every 30s (fallback only)
        Poller->>DB: SELECT pending invoices (not expired more than 60s ago)
        Poller->>Node: get_invoice(payment_hash) — batch, up to 50
        Node-->>Poller: status
        Poller->>DB: (1) update status if changed
        Poller->>DB: (2) bulk-expire invoices past their deadline — runs AFTER (1)
    end
```

Step (1) must run before step (2) in each polling cycle: bulk-expiring doesn't call
the Fiber node at all, it only checks the clock — running it first could mark an
invoice `expired` that was actually paid at almost the exact same moment (status
transitions are one-directional, so there's no way back from `expired` to `paid`
once that happens).

## Data flow — webhook delivery

```mermaid
sequenceDiagram
    participant Trigger as Status-change trigger
    participant DB as PostgreSQL
    participant Scheduler as Retry scheduler
    participant Deliver as Delivery worker
    participant Merchant as Merchant's webhook URL

    Note over Trigger: Invoice status → paid/expired/failed
    Trigger->>DB: SELECT active webhook endpoints<br/>subscribed to this event type
    loop each matching endpoint
        Trigger->>DB: INSERT delivery record (status=pending)
        Trigger->>Scheduler: schedule delivery attempt
    end

    Scheduler->>Deliver: attempt fires
    Deliver->>Deliver: sign payload — HMAC-SHA256(body, endpoint secret)
    Deliver->>Merchant: POST payload<br/>X-Fiber-Signature header (5s timeout)
    Merchant-->>Deliver: HTTP response (or timeout)
    Deliver->>DB: record result (status code, response body, attempt count)
    alt retryable (timeout/network/5xx/429) and fewer than 3 attempts so far
        Deliver->>Scheduler: schedule next attempt (+1 minute, then +5 minutes)
    else non-retryable, or already at 3 attempts
        Deliver->>DB: mark delivery as "failed"
    end
```

Each webhook endpoint signs with its own secret (not a single global signing key),
and retries follow a fixed schedule (`immediate → 1 minute → 5 minutes`) rather than
exponential backoff.

## Invoice status lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending: invoice created
    pending --> paid: Fiber node reports "Paid"
    pending --> expired: node reports expired, OR<br/>the deadline passed before it was ever checked
    pending --> failed: Fiber node reports the invoice was cancelled
    paid --> [*]
    expired --> [*]
    failed --> [*]
```

Status only ever moves in one direction — there's no path back to `pending`, or
from one terminal state to another. In particular, once an invoice is marked
`expired`, it stays `expired` even if the underlying Fiber payment somehow settles
afterward (the protocol itself doesn't enforce invoice expiry at the payee side —
see [Decisions & trade-offs](/decisions-and-tradeoffs) for how this edge case is
currently handled).

| Status | Set when |
|---|---|
| `paid` | The Fiber node confirms the payment actually settled (not just received) |
| `expired` | Either the node reports it, or the deadline passed before a check ever happened |
| `failed` | The Fiber node reports the invoice was cancelled |
