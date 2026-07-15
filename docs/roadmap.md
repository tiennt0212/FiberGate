# Roadmap

Everything below is **beyond the hackathon submission** — the directions FiberGate
would grow in next, grouped by theme rather than strict priority. Several items
reference trade-offs we accepted deliberately for the hackathon timeframe; those are
written up in [Decisions & trade-offs](/decisions-and-tradeoffs) under "Trade-offs
accepted deliberately."

## 1. Dashboard as a full Fiber node operations console

Extend the Dashboard beyond invoice/webhook management toward exposing the Fiber
node's full functionality — deeper peer/channel/liquidity monitoring, and proactive
channel-availability alerts (flagging a channel likely to go inactive or run low on
inbound/outbound capacity *before* it actually blocks a payment) — giving merchants
real operational visibility into the node they're running, not just the payments
flowing through it.

**Automatic channel rebalancing** (currently a fully manual operation) fits here too
— a natural extension once liquidity monitoring exists.

## 2. Continued pain-point research and documentation quality

Keep iterating based on real usage friction — both code/infra (deploy gotchas, error
messages) and documentation (making things equally clear for merchants deploying it
and maintainers extending it) — rather than treating the current doc site and
runbooks as a one-time deliverable.

## 3. A richer payments ecosystem

- **Refund flow** — payer-initiated refund address/invoice + a dedicated
  `send_payment` path and its own DB table. Deliberately out of scope for the
  hackathon timeframe (see "Trade-offs accepted deliberately").
- **WebSocket push to the storefront** — push updates from FiberGate to the storefront
  over WebSocket, not just outbound webhooks — closer to real-time for merchant
  frontends, complementing (not replacing) the signed-webhook model external systems
  already rely on.
- **L402 middleware** — already tracked as Phase 3 (optional), a GitHub milestone with
  [issue #14](https://github.com/tiennt0212/FiberGate/issues/14) open, referencing the
  community [`fiber-l402`](https://github.com/RetricSu/fiber-l402) demo built on
  `@fiber-pay/sdk`.
- **Reconciliation reporting** — cross-checking invoices against on-chain/node snapshot
  data, for merchants who need to audit settlement against the chain, not just channel
  state.

## 4. Operational robustness for production merchants

- **Multi-node / high-availability** — removing the current single-node
  single-point-of-failure.
- **Resource limits in `docker-compose.yml`** — CPU/memory caps per service to prevent
  an OOM in one container from taking down the whole stack.
- **Redis for caching** — the in-memory RUSD/UDT resolution cache and the in-memory
  rate-limit counter (`lib/api/rate-limit.ts`) are both explicitly
  single-process/single-replica-only today (see "Trade-offs accepted deliberately");
  Redis would remove that ceiling and enable horizontal scaling.
- **DB-backed logs** — instead of today's in-memory/process (RAM-only) logging, for
  durability and queryability across restarts and multiple replicas.

## 5. Broader chain/asset coverage

- **Mainnet support** — everything today targets CKB testnet only.
- **A properly multi-asset amount/schema model** — RUSD invoices today reuse the same
  CKB-shaped `amount_shannon`/0.1–1000 CKB validation as native CKB, known to be
  imprecise for other UDTs and accepted as a hackathon-scope shortcut.
