---
type: process
module: infra-gotchas
version: 1.0
last_updated: 2026-09-03
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

- **A Fiber node that announces no *reachable* address is banned by every peer it
  meets** — and the failure is silent from the app's side: the node boots healthy,
  `docker compose ps` is green, RPC answers, but `list_peers` stays empty and no
  payment can ever route to it. Peers reject its `NodeAnnouncement` with
  `ProcessingError("private address node announcement")` →
  `PolicyRejectedMessage` → `MaliciousPeerFound` → ban. Three traps stacked on top
  of each other here: (1) upstream's own `config/testnet/config.yml` ships
  `announced_addrs` empty, so inheriting it verbatim inherits the bug — it's a
  template with a blank the operator is expected to fill; (2)
  `announce_listening_addr: true` does NOT compensate — `fnn` pushes the listening
  address then filters it right back out via `is_addr_reachable()`, since `0.0.0.0`
  isn't reachable (`crates/fiber-lib/src/fiber/network.rs`, the `retain` call);
  (3) only `/dns4`, `/dns6`, `/onion3` or a genuinely public IP passes that check —
  an RFC1918 Docker IP does not. Announce via the `FIBER_ANNOUNCED_ADDRS` env var
  (set in `docker-compose.yml`, derived from `.env`'s `DOMAIN`), never by editing
  `config.yml` — that file is copied verbatim into `create-fibergate`'s templates,
  so a value hardcoded there ships to every merchant. Diagnose with
  `docker compose logs fiber-node | grep "announced addresses"` — `[]` means it's
  announcing nothing.

- **A CDN proxy silently swallows the P2P port, and every layer still reports
  success** — if `DOMAIN` is a Cloudflare record with the proxy on ("orange
  cloud"), the name resolves to Cloudflare, not to your host. Cloudflare only
  forwards a fixed set of HTTP/HTTPS ports, and 8228 is not among them, so P2P
  connections die at the edge and never reach the server at all. Every check you
  would naturally run still passes: the node logs a correct `announced
  addresses [...]`, `node_info` returns both multiaddrs, the origin has 8228 open,
  nginx holds a valid Let's Encrypt cert, and `is_addr_reachable()` accepts the
  address because it never resolves or dials a `/dns4` name — it only checks the
  protocol component. Confirmed live: `443` open through the proxied name while
  `8228` was refused on the same name, and both open on the origin IP directly.
  Fix: a second, DNS-only ("grey cloud") record for the same host, set as
  `FIBER_P2P_DOMAIN`. The certificate must cover that name too — `openssl
  s_client -verify_hostname <name>` is the check that catches it, since a plain
  `s_client` reports `Verify return code: 0 (ok)` on a **mismatched** name (it
  validates the chain, not the hostname, unless asked).

- **Changing an env var in `.env` needs `docker compose up -d <svc>`, not
  `docker compose restart <svc>`** — `restart` reuses the existing container with
  the values it was created with, so the edit appears to do nothing. Only bites
  vars read by the container itself (e.g. `FIBER_ANNOUNCED_ADDRS`); a
  volume-mounted config file like `config.yml` *is* re-read by a plain `restart`,
  which makes the inconsistency easy to trip over.

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

- **A failed `certbot certonly` run leaves an orphaned `renewal/<domain>.conf`
  behind even though it errored out** — certbot's `new_lineage()` opens/creates
  the renewal config file *before* checking whether `live`/`archive` already
  exist, and never deletes it on that error path. If you manually clean up after
  a failed run by only `rm -rf`-ing `live/<domain>` and `archive/<domain>` (not
  the renewal config too), the next `certonly` attempt sees the leftover config,
  assumes the plain domain name is taken, and silently saves the new cert under
  a `-0001`-suffixed name instead — which `nginx.conf.template` never looks for,
  so `nginx -s reload` fails with a cryptic "no such file" error with no
  connection back to the original problem. Always clear all three together:
  `live/<domain>`, `archive/<domain>`, AND `renewal/<domain>.conf`. `certbot-init`
  now checks for both `renewal/${DOMAIN}.conf` and `live/${DOMAIN}/cert.pem`
  before deciding whether to self-heal — see `decisions-log.md` 2026-07-15.

- **A hand-typed shell variable inside a Compose `command:`/`entrypoint:` block
  must use `$$`, not `$`, even though it "looks like" it should just work** —
  Compose's own interpolation pass runs first and silently treats any single
  `$VAR` as ITS OWN variable to substitute (logging a barely-visible `variable is
  not set, defaulting to blank string` warning), not as a variable for the
  container's shell to resolve at runtime. This reduced an `if [ ! -f "$X" ]`
  check to comparing against an empty string without erroring loudly — caught
  only by running `docker compose config` and reading the fully-resolved script
  before it ever reached a container. Only `${DOMAIN}`/`${CERTBOT_EMAIL}`-style
  values that are genuinely meant to be baked in from `.env` at Compose-parse
  time should stay single-`$`; anything the script assigns/computes itself needs
  `$$`.

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
