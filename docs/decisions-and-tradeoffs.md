# Decisions, trade-offs, and roadmap

This is the narrative version of `.context/processes/decisions-log.md` (a
chronological, line-by-line engineering log) — written for judges and reviewers who
want to understand *why* FiberGate is built the way it is, not just *what* it does.
Every claim below is backed by an entry in that log if you want the full detail.

## Product framing: self-hosted infrastructure, not a custodial SaaS

FiberGate started as a managed, multi-tenant "Fiber payment gateway" concept and was
deliberately pivoted, on day one, to a self-hosted, open-source framework: a
merchant runs `docker compose up -d` on their own infrastructure and keeps their own
node, keys, and funds. The reason was the hackathon's own rule — "infrastructure
only, not products built on top." A custodial SaaS serving multiple merchants reads
as a *product*; a framework any merchant can deploy and operate themselves reads as
*infrastructure*. This single decision shaped almost everything downstream:
single-tenant auth (one shared secret, no per-client API keys), a single-admin
dashboard (no user/role system), and plain PostgreSQL instead of a heavier
self-hosted Supabase stack (10+ containers for Auth/Realtime/Storage that a
single-tenant app doesn't need).

We also deliberately don't call this an "LSP" (Lightning Service Provider analogue)
— FiberGate doesn't open channels or provide liquidity on behalf of a third party.
It's a payment gateway that sits on top of a node the merchant already runs and
funds themselves.

## Real infrastructure gotchas found by actually running this on a live node

A recurring theme in this project: several assumptions that looked correct on paper
turned out to be wrong the first time they were exercised against a real `fnn` node,
and were only caught because every non-trivial claim was verified live rather than
assumed from documentation. Four worth highlighting:

1. **`0.0.0.0` counts as a "public" bind, even inside a private Docker network.**
   `fiber-node`'s RPC needed to be reachable from the `fibergate-core` container, so
   it seemed natural to bind `0.0.0.0:8227`. `fnn` refuses to start on any address it
   classifies as public without Biscuit auth configured — and it classifies
   `0.0.0.0` as public regardless of whether the host actually routes anywhere.
   Fixed by giving `fiber-node` a static private IP (`172.28.0.10`) on its own
   Docker network instead — private-range IPs pass the check, no Biscuit auth
   machinery needed for a connection that's genuinely never exposed.

2. **`.env` files silently corrupt values containing `$`, two different ways.**
   Docker Compose's own `.env` interpolation and `dotenv-expand` (used by `pnpm
   dev`/`build`) each mangle a bcrypt hash's literal `$` characters differently — no
   escaping strategy satisfies both readers at once (verified against real running
   containers, not just `docker compose config`'s output, which re-escapes `$` on
   display and looks fine even when the runtime value is wrong). The fix:
   base64-encode the hash before it goes into `.env` at all — base64's alphabet has
   no `$`, so both readers pass it through untouched.

3. **A `ckb-cli`-exported extended private key isn't the format `fnn` accepts.**
   `ckb-cli account export --extended-privkey-path` writes 2 lines (raw key + chain
   code); `fnn` wants exactly 1 line of raw hex. The decrypt error this produces
   (`aead::Error`) looks like a wrong password, not a format mismatch, and cost real
   debugging time before the file's byte/line count gave it away.

4. **A cache for RUSD/UDT resolution had a stale-forever bug and a request-storm
   race**, both found by `/code-review` rather than manual testing: caching "RUSD
   isn't configured" forever (because node restarts don't cascade to
   `fibergate-core` restarts, so a config fix on the node side would never be
   noticed) and multiple concurrent RUSD invoice requests each firing their own
   redundant `node_info` call before the first lookup resolved (check-then-act race,
   not just a missed cache hit). Fixed by caching the in-flight *promise* instead of
   the resolved value, and invalidating on both RPC failure and "still not found."

## Phase 2: real-time invoice detection

The original design polled the Fiber node every 10 seconds to detect invoice status
changes. This is now replaced as the primary mechanism by a WebSocket subscription
to the node's `subscribe_store_changes` pubsub RPC — invoices flip to `paid`
within seconds of settlement instead of up to 10s later, and the interval poller is
demoted to a 30s fallback (kept deliberately, not removed) because the Fiber team's
own docs describe this RPC as intended primarily for Cross-Chain Hub integration,
not general client use — we're relying on documented, stable behavior that isn't
officially scoped for this use case.

Two more live-verification gotchas surfaced building this: the `pubsub` RPC module
isn't in `fnn`'s default enabled-module list (had to be added explicitly to
`config.yml`, found by reading the node's actual source rather than assuming the
docs' RPC list was exhaustive), and the subscription ID the node returns is a raw
JSON number, not a string — every generic jsonrpsee example implies a string, and a
type check written against that assumption silently never resolved until tested
against a real handshake.

## Trade-offs accepted deliberately

- **Single node, testnet only.** One Fiber node per deployment is a single point of
  failure by construction — the same trade-off any LSP/node operator makes, just
  self-hosted instead of custodial.
- **Settlement delay is real.** An invoice showing `paid` reflects a settled HTLC
  inside a payment channel, not a confirmed on-chain transaction — this is inherent
  to how Lightning-style channels work, not a FiberGate shortcut.
- **No refunds.** Fiber, like Lightning, is a push-payment protocol with no
  "pull back" primitive. A real refund needs the payer to supply a refund address or
  invoice up front, consumes real liquidity to send back, and needs its own
  `send_payment` flow and a new DB table — judged out of proportion to the
  hackathon's timeframe, deferred to the roadmap below rather than half-built.
- **No job queue for webhook retries.** Retry scheduling (`next_retry_at`) is a
  plain interval scanner over `webhook_deliveries`, not Redis/BullMQ or a
  Postgres-native queue engine — the value a queue engine adds (multi-worker
  coordination, backpressure) doesn't exist yet because `fibergate-core` runs as a
  single, non-horizontally-scaled process. Documented as the first thing to
  reconsider if that assumption changes.
- **In-memory rate limiting.** The 100-invoices/minute guard (anti-abuse, not a hard
  financial control) is an in-memory sliding window, not DB- or Redis-backed —
  correct for a single-replica deployment, resets on restart, and would need
  revisiting under horizontal scaling.

## Roadmap

Beyond the hackathon submission, in roughly the order they'd add the most value:

- **Mainnet support** — everything today targets CKB testnet only.
- **L402 subscription middleware** (pay-per-request API paywall) — a Phase 3 stretch
  goal, referencing the community `fiber-l402` demo built on `@fiber-pay/sdk`.
- **Multi-node / high-availability** deployments.
- **Automatic channel rebalancing** (currently a manual operation).
- **A real refund flow** — payer-initiated refund address/invoice + a dedicated
  `send_payment` path and DB table, as described above.
- **Reconciliation reporting** — cross-checking `invoices` against on-chain/node
  snapshot data.
- **A properly multi-asset amount/schema model.** RUSD invoices today reuse the same
  `amount_shannon`/0.1–1000 CKB-shaped validation as native CKB; that's known to be
  imprecise for other UDTs and was accepted as a hackathon-scope shortcut.
