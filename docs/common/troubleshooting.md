# Troubleshooting

Errors you might hit regardless of which path you're on (a `create-fibergate`-scaffolded
deploy, hand-editing that output for full manual control, or running from source as a
contributor). Grouped by area — jump to the one that matches your symptom. See also
[Manual / advanced deployment](../merchants/deployment.md) and
[Public HTTPS deploy](../merchants/public-https-deploy.md) for the
steps these errors are most likely to come up during.

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
  starting with `$2y$` or `$2b$`. (Root cause, if you're curious: Docker Compose's
  `.env` interpolation and `dotenv-expand` — used by `pnpm dev`/`build` — each corrupt
  literal `$` characters differently; base64 has no `$` in its alphabet, so it's the
  one encoding that survives both paths intact. See
  [Decisions, trade-offs, and roadmap](../decisions-and-tradeoffs.md).)

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
- **`fiber-node` starts but then exits with "Cannot listen on a public address without
  a biscuit public key set in the config"** — don't change
  `docker/fiber-node/config.yml`'s `rpc.listening_addr` to `0.0.0.0`; `fnn` treats
  that as a public bind and refuses to start without Biscuit auth configured. It's
  already pre-seeded with a static private IP (`172.28.0.10`) matching the
  `fiber-node` service's `ipv4_address` in `docker-compose.yml` — if you edited either
  of those, keep them in sync.

## Public HTTPS / TLS / WSS

- **`https://$DOMAIN` shows a certificate warning / "not secure"** — expected until
  you've run the one-time certbot command in
  [Public HTTPS deploy](../merchants/public-https-deploy.md). Until
  then `nginx` is serving the temporary self-signed cert `nginx-certs-preflight`
  generated so it could start at all — normal on first boot, not a bug.
- **The certbot command fails with a challenge/timeout error** — almost always DNS or
  port-forwarding, not `.env`. Confirm `DOMAIN` actually resolves to this host's
  public IP (`dig +short $DOMAIN` from a machine that isn't this one) and that ports
  80/443/8228 are forwarded to it — Let's Encrypt has to reach port 80 on this host
  from the public internet to validate the challenge.
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
