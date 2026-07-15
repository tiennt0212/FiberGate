# Troubleshooting

Hit a snag? Find your symptom below and jump to the fix. These cover every deploy path — the
scaffolded wizard output, a hand-edited version of it, or running from source as a contributor.

Grouped by area. For the steps these errors tend to come up during, see also
[Manual / advanced deployment](../merchants/deployment.md) and
[Public HTTPS deploy](../merchants/public-https-deploy.md).

## Startup / `.env`

- **`postgres` or `fibergate-core` fail to start / crash on boot** — almost always a
  blank required var in `.env`. Check `docker compose logs postgres` or
  `docker compose logs fibergate-core` for the specific error, then fill in the
  missing value — `create-fibergate` generates these for you (see
  [Quickstart for merchants](../merchants/quickstart.md)); if you hand-edited
  `.env` afterward, double-check you didn't blank one out.
- **`fibergate-core` never starts, even though `.env` looks complete** — it has
  `depends_on: condition: service_healthy` on both `postgres` and `fiber-node`, so it
  intentionally won't start until both report healthy. Run `docker compose ps` to see
  which one isn't healthy yet, then check that service's logs.
- **Dashboard login fails even with the right password** — check that
  `ADMIN_PASSWORD_HASH_B64` in `.env` is the base64-encoded hash `create-fibergate`
  generated for you, not the raw `$2y$10$...` hash pasted directly. Decode it locally to
  sanity-check: `echo "$ADMIN_PASSWORD_HASH_B64" | base64 -d` should print a string
  starting with `$2y$` or `$2b$`.

  <details><summary>Why base64, if you're curious</summary>

  Docker Compose's `.env` interpolation and `dotenv-expand` (used by `pnpm dev`/`build`)
  each corrupt literal `$` characters differently, and a bcrypt hash is full of them.
  base64 has no `$` in its alphabet, so it's the one encoding that survives both paths
  intact. Full story in [Decisions & trade-offs](../decisions-and-tradeoffs.md).

  </details>
- **`fibergate-core` fails to connect to Postgres with `password authentication failed
  for user "fibergate"`, even though `.env` looks correct** — almost always a stale
  `postgres-data` volume from an earlier `docker compose up -d` in the same directory.
  The official `postgres` image only applies `POSTGRES_USER`/`POSTGRES_PASSWORD`/
  `POSTGRES_DB` the **first** time it initializes an empty data volume — if you already
  ran `docker compose up -d` once before (then re-ran `create-fibergate` into the same
  deploy directory, which generates a brand-new random password each time, or
  hand-edited `POSTGRES_PASSWORD`), the running Postgres container is silently still
  using the **old** password baked into the volume, while `fibergate-core` connects
  with the new one from `.env`.
  - If there's no real data in that Postgres instance yet (a fresh/test deploy):
    `docker compose down -v` (drops the volume — **destroys all data in it**) then
    `docker compose up -d` to reinit fresh against the current `.env`.
  - If you need to keep existing data (real invoices/webhooks already recorded):
    don't run `down -v`. Instead, sync the password inside the already-running
    container to match `.env`:
    `docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER USER \"$POSTGRES_USER\" WITH PASSWORD '<the POSTGRES_PASSWORD value from .env>';"`

## `fiber-node`

- **`fiber-node-preflight` exits with a "missing CKB testnet key" message and
  `fiber-node` never starts** — expected if you skipped providing the CKB key. The
  message printed by that container tells you exactly what's missing; add the key
  file at `docker/fiber-node/ckb/key` and re-run `docker compose up -d`.
- **`fiber-node` restarts in a loop with `Secret key file error: decryption failed:
  aead::Error`** — usually **not** a wrong password. The most common cause is the key
  file having the wrong format: it must be exactly 1 line of raw private-key hex, no
  `0x` prefix. If you exported it with
  `ckb-cli account export --extended-privkey-path`, that file has 2 lines (private
  key + chain code) — `head -n 1` it first. Only after ruling that out, check whether
  `FIBER_SECRET_KEY_PASSWORD` actually matches the passphrase used to encrypt the key.
::: danger `0.0.0.0` counts as "public", even inside a private Docker network
**`fiber-node` starts but then exits with "Cannot listen on a public address without
a biscuit public key set in the config"** — don't change
`docker/fiber-node/config.yml`'s `rpc.listening_addr` to `0.0.0.0`; `fnn` treats
that as a public bind and refuses to start without Biscuit auth configured. It's
already pre-seeded with a static private IP (`172.28.0.10`) matching the
`fiber-node` service's `ipv4_address` in `docker-compose.yml` — if you edited either
of those, keep them in sync.
:::

## Public HTTPS / TLS / WSS

- **`https://$DOMAIN` shows a certificate warning / "not secure"** — expected until
  you've run the one-time `docker compose run --rm certbot-init` in
  [Public HTTPS deploy](../merchants/public-https-deploy.md). Until
  then `nginx` is serving the temporary self-signed cert `nginx-certs-preflight`
  generated so it could start at all — normal on first boot, not a bug.
- **`certbot-init` fails with a challenge/timeout error** — almost always DNS or
  port-forwarding, not `.env`. Confirm `DOMAIN` actually resolves to this host's
  public IP (`dig +short $DOMAIN` from a machine that isn't this one) and that ports
  80/443/8228 are forwarded to it — Let's Encrypt has to reach port 80 on this host
  from the public internet to validate the challenge.
- **`certbot-init` fails with a DNS-related timeout during Let's Encrypt's
  validation, even though DNS and port-forwarding are both actually correct** —
  free/dynamic DNS providers can have slow or unreliable authoritative DNS
  answering, which can cause Let's Encrypt's multi-perspective ("secondary
  validation") checks to fail even when your own setup is fine. Confirm this is
  the cause by checking DNS resolution consistency for `$DOMAIN` across a couple
  of different public resolvers (e.g. a DNS-over-HTTPS query to two different
  providers) — if they don't agree yet, this is likely transient, and simply
  retrying `docker compose run --rm certbot-init` after a few minutes is often
  enough.
- **`certbot-init` prints `Account registered.` / `Requesting a certificate for
  $DOMAIN` with no validation error, then fails with `live directory exists for
  $DOMAIN`** — this means the Let's Encrypt challenge actually succeeded; the
  failure is a local storage conflict between certbot and
  `nginx-certs-preflight`'s temporary self-signed placeholder, which
  `certbot-init` now clears automatically before requesting a real cert (fixed
  2026-07-15 — if you're on an older image, update and re-run
  `docker compose run --rm certbot-init`). Not a DNS/port-forwarding issue, and
  safe to retry immediately (no rate-limit risk from this failure mode).
- **`certbot-init` reports `Successfully received certificate`, but `docker
  compose exec nginx nginx -s reload` then fails with `cannot load certificate
  ... No such file or directory`** — this means the cert got saved under a
  `-0001`-suffixed name (e.g. `live/$DOMAIN-0001/`) instead of the plain
  `live/$DOMAIN/` that nginx expects. This happens if you already hit the "live
  directory exists" error above once and cleaned it up by hand — a failed
  `certonly` run can leave an orphaned `renewal/$DOMAIN.conf` behind even though
  it errored, and manually `rm -rf`-ing only `live/`/`archive/` (not that config
  file too) makes the next run think the domain name is already taken.
  `certbot-init` now checks for this too (fixed 2026-07-15) — update and clear
  all of `live/$DOMAIN`, `archive/$DOMAIN`, `renewal/$DOMAIN.conf` (and any
  `-0001`-suffixed variants already created) before re-running
  `docker compose run --rm certbot-init`.
- **The real cert is installed and verified server-side (`curl -v https://$DOMAIN`
  shows `SSL certificate verify ok`), but a browser tab still shows "Not secure"**
  — if that tab already had the site open before the fix (e.g. it previously hit
  the temporary self-signed cert's warning), the browser can keep showing cached
  "insecure" state for that origin. Try a hard refresh, or open the URL in a
  private/incognito window, before assuming the server-side fix didn't work.
- **"Pay with browser wallet" in the demo storefront still can't connect after
  setting up WSS** — double-check `docker/fiber-node/config.yml`'s `announced_addrs`
  was actually uncommented/edited with the real domain and `fiber-node` was restarted
  (`docker compose restart fiber-node`) — this file isn't templated from `.env`, it's
  a manual edit.

## Testing payments with `fiber-node-payer`

(See [Demo storefront](../merchants/demo-storefront.md) for the
full flow this refers to.)

- **`connect_peer` succeeds but the peer disappears from `list_peers` within ~1s, and
  `open_channel` fails with `"...waiting for peer to send Init message"`** — gossip
  backlog overflow, not a transient issue. Happens when `fiber-node` has accumulated a
  lot of real gossip data and dumps it all on the freshly-connected payer at once.
  Already worked around in `docker/fiber-node-payer/config.yml`
  (`gossip_network_num_targeted_active_syncing_peers: 0`, no `bootnode_addrs`) — if
  you still hit this, check `fiber-node`'s own `graph_channels` count via `node_info`.
- **`open_channel` returns a `temporary_channel_id`, but `fiber-node`'s logs show
  `"Failed to fund channel: ... need more capacity"`** — `fiber-node` itself needs its
  own 99 CKB channel reserve to *accept* a channel, not just the opener's funding
  amount. Fund `fiber-node`'s own address via the [faucet](https://faucet.nervos.org).
- **Channel stuck at `AwaitingTxSignatures` with all 3 signature flags set** —
  normal; wait ~20-30s for the funding transaction to confirm on-chain, then re-poll
  `list_channels`. A tx hash showing `status: "unknown"` right after signing is
  expected, not a failure.
