# create-fibergate

[![npm](https://img.shields.io/npm/v/create-fibergate?color=cb3837&logo=npm)](https://www.npmjs.com/package/create-fibergate)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/tiennt0212/FiberGate/blob/canary/LICENSE)

Scaffold a [FiberGate](https://github.com/tiennt0212/FiberGate) merchant deploy
directory with one interactive command — no manual secret generation, no
hand-editing `.env`.

```bash
npx create-fibergate@latest my-fibergate-deploy
# or
npm create fibergate@latest my-fibergate-deploy
```

## What it does

The wizard prompts for the values a [FiberGate](https://github.com/tiennt0212/FiberGate)
merchant deploy needs, then writes a ready-to-run directory:

- Postgres credentials (generate a random password, or bring your own)
- The initial dashboard admin password — hashed locally with bcrypt, never sent
  anywhere
- Your CKB testnet signing key for `fiber-node` — either a fresh key you've
  already exported via `ckb-cli`, or one already encrypted from a prior
  deploy (the passphrase is verified **offline**, before anything is written,
  so a typo doesn't surface later as a cryptic container crash)
- `DOMAIN` (defaults to `localhost`) / `GHCR_NAMESPACE` for the public HTTPS deploy —
  `CERTBOT_EMAIL` isn't prompted for, it's optional and only needed once you get a
  real TLS cert later
- 3 secrets generated automatically (`DASHBOARD_SESSION_SECRET`,
  `FIBERGATE_INTERNAL_SECRET`, `WEBHOOK_SECRET_ENCRYPTION_KEY`)

Output directory:

```
my-fibergate-deploy/
  docker-compose.yml
  .env
  docker/fiber-node/config.yml
  docker/fiber-node/ckb/key
  docker/nginx/nginx.conf.template
```

Then:

```bash
cd my-fibergate-deploy
docker compose up -d
```

That's it — `fibergate-core` runs pending DB migrations automatically before it
starts serving, on first install or any later version upgrade.

New to FiberGate? See [what it is](https://tiennt0212.github.io/FiberGate/introduction) and the
[merchant walkthrough](https://tiennt0212.github.io/FiberGate/merchants/walkthrough) for the full
journey from here to your first payment.

## Security notes

- `.env` and `docker/fiber-node/ckb/key` are written with `0600` permissions
  (owner read/write only) — both hold secrets.
- The CLI never mints a new CKB keypair — you always supply your own key,
  exported via `ckb-cli`.
- Nothing is sent over the network. Everything runs locally on your machine.

## License

MIT
