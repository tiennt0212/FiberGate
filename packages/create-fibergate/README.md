# create-fibergate

Scaffold a [FiberGate](https://github.com/tiennt0212/FiberGate) merchant deploy
directory with one interactive command — no manual `openssl rand`, no
`docker run ... htpasswd`, no hand-editing `.env`.

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
- `DOMAIN` / `CERTBOT_EMAIL` / `GHCR_NAMESPACE` for the public HTTPS deploy
- 3 secrets generated automatically (`DASHBOARD_SESSION_SECRET`,
  `FIBERGATE_INTERNAL_SECRET`, `WEBHOOK_SECRET_ENCRYPTION_KEY`)

Output directory:

```
my-fibergate-deploy/
  docker-compose.release.yml
  .env
  docker/fiber-node/config.yml
  docker/fiber-node/ckb/key
  docker/nginx/nginx.conf.template
```

Then:

```bash
cd my-fibergate-deploy
docker compose -f docker-compose.release.yml up -d
```

See the [main repo](https://github.com/tiennt0212/FiberGate) for what
FiberGate is and the full deploy guide.

## Security notes

- `.env` and `docker/fiber-node/ckb/key` are written with `0600` permissions
  (owner read/write only) — both hold secrets.
- The CLI never mints a new CKB keypair — you always supply your own key,
  exported via `ckb-cli`.
- Nothing is sent over the network. Everything runs locally on your machine.

## License

MIT
