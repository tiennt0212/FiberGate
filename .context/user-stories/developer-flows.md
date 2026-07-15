---
type: user_stories
persona: developer
version: 1.0
last_updated: 2026-07-02
tags: [integration, onboarding, webhook, sdk]
---

# User Stories — Developer Integration

## US-001: Deploy FiberGate with Docker Compose

**As a** merchant who wants to accept Fiber payments,
**I want to** self-deploy FiberGate on my own infrastructure,
**So that** I run my own node and data, without depending on a third party.

**Acceptance criteria:**
- Current recommended path: `npx create-fibergate@latest` — a wizard that auto-generates `.env`
  (secrets + admin password hash) and handles the CKB key for you, see
  `docs/merchants/quickstart.md`. Below is the manual/from-source flow (for contributors,
  or merchants who want full control) — see `docs/merchants/deployment.md` and
  `docs/maintainers/getting-started.md`.
- Clone the repo, copy `.env.example` → `.env`, set the required vars: `POSTGRES_PASSWORD`, `ADMIN_PASSWORD_HASH_B64`, `DASHBOARD_SESSION_SECRET`, `FIBERGATE_INTERNAL_SECRET` (`FIBER_NODE_URL` already has a default value for the docker network, no need to change it; `DATABASE_URL` isn't set directly — it's derived from `POSTGRES_*`)
- Supply a CKB testnet key for fiber-node (`docker/fiber-node/ckb/key` + `FIBER_SECRET_KEY_PASSWORD`) — see `docs/maintainers/getting-started.md`'s "Generating a real `.env`"
- Run `docker compose up -d` → starts 3 containers: fiber-node, postgres, fibergate-core
- Access the dashboard, log in with the plaintext password used to create `ADMIN_PASSWORD_HASH_B64` (single-admin, no sign-up)
- Can revoke/rotate `FIBERGATE_INTERNAL_SECRET` by changing the env var and restarting the container

## US-002: Integrate the SDK into a Next.js app

**As a** developer using Next.js,
**I want to** integrate Fiber payments in 10 minutes,
**So that** my users can pay with CKB.

**Acceptance criteria:**
```bash
npm install @fibergate/sdk
```
```typescript
// Create an invoice (server-side) — points at your self-deployed FiberGate core
const gateway = new FiberGate({
  baseUrl: process.env.FIBERGATE_BASE_URL,       // http://<merchant-host>:<port>
  internalSecret: process.env.FIBERGATE_INTERNAL_SECRET,
})
const invoice = await gateway.invoices.create({ amount: 1, asset: 'CKB' })

// Verify webhook (in a route handler)
const isValid = gateway.webhooks.verify(body, signature, secret)
```

## US-003: Receive a webhook when a payment happens

**As a** developer,
**I want to** receive an HTTP notification when a user finishes paying,
**So that** I can fulfill the order immediately.

**Acceptance criteria:**
- Go to dashboard → Webhooks → Add endpoint
- Enter the URL and select events (payment.paid, invoice.expired)
- Receive a webhook secret to verify the signature
- Can view the webhook delivery history (status, response, timestamp)
- A "Resend" button exists for failed deliveries

## US-004: Monitor node and channel status

**As a** developer,
**I want to** view node status and liquidity capacity,
**So that** I know whether the gateway has enough capacity to accept payments.

**Acceptance criteria:**
- Dashboard shows: node online/offline, number of active channels, inbound/outbound capacity
- If inbound capacity < 10 CKB → shows a "Low capacity" warning
- GET /api/v1/node/info returns this information