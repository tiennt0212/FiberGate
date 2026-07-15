---
type: process
module: infra-gotchas
version: 1.0
last_updated: 2026-07-15
tags: [gotchas, infra, fiber, docker, ai-agent]
---

# Infra/protocol gotchas that took real effort to track down

> Each item below was initially misunderstood and only discovered through empirical
> verification (running it for real, not just reading code/docs). Full details + how
> it was verified: `.context/processes/decisions-log.md`. Don't repeat these mistakes.

---

- **`fnn` treats `0.0.0.0` as "public" even when it's only bound within a private
  Docker network** (even when the host doesn't actually route it externally) —
  don't bind RPC to `0.0.0.0` "for easier connectivity" between containers; use a
  static private IP on a private network instead.

- **`.env` gets the `$` character corrupted in 2 different ways** (Docker Compose
  interpolation vs `dotenv-expand`) — values containing `$` (e.g. a bcrypt hash)
  must be base64-encoded before being written into `.env`; there's no escaping
  scheme that satisfies both readers at once.

- **`ckb-cli account export --extended-privkey-path` outputs 2 lines (key + chain
  code), but `fnn` only accepts a single raw hex line** — the resulting
  `aead::Error` on decrypt looks like a wrong password but is actually a format
  mismatch.

- **`pubsub` is not in FNN's default `enabled_modules`** — it must be explicitly
  declared in `docker/fiber-node/config.yml`; setting this field REPLACES the
  default entirely, it doesn't append to it.

- **`subscribe_store_changes`'s returned subscription id is a JSON number, not a
  string** — code that only checks `typeof result === "string"` will never resolve
  against a real node, even though a unit test with a made-up response shape still
  passes.

- **The RUSD/UDT resolution cache can go stale-forever or hit a request-storm race
  if cached by value instead of by in-flight promise** — a "not yet configured"
  result gets cached forever unless invalidation is handled correctly for both RPC
  failures and "still not found."

- **An `expired` invoice cannot be reversed even if the real payment later
  settles** — the Fiber network doesn't enforce `expiry` at the payee layer; this
  is a business rule with no settled fix direction yet, see issue #51 — don't
  change the behavior unilaterally.

- **Docker Compose doesn't automatically forward the entire `.env` into the
  container** — every app-level variable that needs to be visible inside a
  container must be explicitly listed in that service's `environment:` block;
  `pnpm dev` doesn't expose this bug because it loads the root `.env` directly via
  `dotenv-cli`, bypassing Compose's allowlist entirely. Verify with
  `docker compose config | grep <VAR_NAME>`. Any new variable added to
  `.env.example` must be cross-checked against `docker-compose.yml`'s
  `environment:` block in the same session — the two don't auto-sync.

- **`env_file:` in an override compose file resolves its path relative to the
  project directory (the directory containing the first `-f` file), not relative
  to the directory containing the override file itself** — the same behavior
  already noted for `build.context`. Easy to get wrong when adding a new service
  overlay (e.g. `apps/demo-storefront/docker-compose.demo.yml`) without testing
  the full command `docker compose -f docker-compose.yml -f
  apps/demo-storefront/docker-compose.demo.yml up -d` from the correct working
  directory.

- **`nginx-certs-preflight`'s temporary self-signed cert collides with certbot's own
  storage path** — it writes directly to `/etc/letsencrypt/live/${DOMAIN}/*.pem` (the
  same path certbot uses for a real lineage) without a matching
  `renewal/${DOMAIN}.conf`, so `certbot-init`'s first real `certonly` run succeeds
  against Let's Encrypt (account registered, challenge validated) but then aborts
  with `live directory exists for <domain>` at the final save-to-disk step, since
  certbot refuses to overwrite a `live/` directory it doesn't recognize as its own.
  Fixed by making `certbot-init` clear that placeholder itself (only when no real
  `renewal/${DOMAIN}.conf` exists yet) before calling `certonly` — see
  `decisions-log.md` 2026-07-15.

- **The `postgres` image only applies `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`
  on first init of an empty `postgres-data` volume** — if that volume already exists
  from an earlier `docker compose up -d`, a newer `.env` (e.g. after re-running
  `create-fibergate` into the same deploy directory, or hand-editing
  `POSTGRES_PASSWORD`) is silently ignored by Postgres itself, so `fibergate-core`
  ends up authenticating with a password that no longer matches what's actually in
  the volume — `password authentication failed for user "fibergate"`. Fix: `docker
  compose down -v` (destroys the volume — only safe if there's no real data to
  keep) then `up -d` to reinit against the current `.env`; if real data needs to be
  preserved, sync the password inside the running container instead of wiping it.
