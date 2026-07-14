# Manual / advanced deployment

Start from [`npx create-fibergate@latest`](quickstart.md) even if what you actually
want is manual control — it already writes a correct `docker-compose.yml` + `.env`
for you, with real values filled in (not placeholders). Treat that output as a
starting point you're free to hand-edit, not a black box you're locked into.

## No Node.js on the target host?

Run the scaffolding step on any machine that has Node.js — your laptop, CI, etc. —
then copy the generated directory to the deploy host:

```bash
npx create-fibergate@latest fibergate-deploy   # on a machine with Node.js
scp -r fibergate-deploy your-host:~/fibergate-deploy
ssh your-host 'cd fibergate-deploy && docker compose up -d'
```

Only `docker` is needed on the deploy host itself.

## Editing the generated files

- **Pin to a specific `fibergate-core` build** instead of `:latest` — edit the
  `image:` line in `docker-compose.yml` to
  `ghcr.io/<namespace>/fibergate-core:sha-<commit>`.
- **Rotate a secret** (e.g. `FIBERGATE_INTERNAL_SECRET`) — edit the value directly in
  `.env`, then `docker compose up -d` to apply.
- **Change the admin password** — do this from Dashboard → Settings instead of
  re-editing `.env` (see [`quickstart.md`](quickstart.md)).

## Worth knowing

- **CKB testnet signing key**: `create-fibergate` generates/encrypts this for you
  during scaffolding from a raw key you provide once. Reusing an already-encrypted
  key from a prior deploy? The CLI validates the passphrase offline before writing
  anything.
- **`DOMAIN`/`CERTBOT_EMAIL`**: see [`public-https-deploy.md`](public-https-deploy.md)
  if you want a public HTTPS domain — not required for `docker compose up -d` to
  work locally.

Something failed along the way? See
[`../common/troubleshooting.md`](../common/troubleshooting.md).
