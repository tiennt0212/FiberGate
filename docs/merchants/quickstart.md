# Quickstart for merchants

The fastest way to get a FiberGate deployment running is the scaffolding CLI —
`create-fibergate` on npm. It writes everything a deployment needs (compose file,
`.env` with generated secrets, admin password hash, CKB key handling) so you never
hand-edit `.env` or run `openssl rand`/`htpasswd` yourself.

```bash
npx create-fibergate@latest fibergate-deploy
cd fibergate-deploy
docker compose up -d
```

That's it for a working local/testnet deployment. What the wizard does, step by step:

1. Prompts for Postgres credentials.
2. Prompts for your dashboard admin password — hashes it locally (bcrypt), never
   sends it anywhere.
3. Prompts for your CKB testnet signing key — either paste a fresh raw-hex key to
   have it encrypted for you, or reuse an already-encrypted key from a prior deploy
   (the passphrase is validated **offline** before anything is written to disk).
4. Prompts for `DOMAIN` and `GHCR_NAMESPACE` (the GitHub org/user the
   `fibergate-core` image is published under), auto-generates the remaining 3
   secrets (`FIBERGATE_INTERNAL_SECRET`, `WEBHOOK_SECRET_ENCRYPTION_KEY`,
   `DASHBOARD_SESSION_SECRET`).
5. Writes a ready-to-run `docker-compose.yml` + `.env` + `.gitignore` into the target
   directory, using the published `fibergate-core` GHCR image — no monorepo clone
   needed.

`docker compose up -d` then brings up all services; `fibergate-core` runs its
pending DB migrations automatically before it starts serving — no manual migrate
step, on first install or any later upgrade.

## After it's up

- **Dashboard**: `http://<your-host>:3000` (or `https://$DOMAIN` once you've completed
  [public HTTPS setup](public-https-deploy.md)) — log in with the admin password you
  set during scaffolding.
- **Create an invoice**: `POST /api/v1/invoices` with
  `Authorization: Bearer <FIBERGATE_INTERNAL_SECRET>` (the value the CLI generated
  for you, in `.env`). See the API spec in `.context/api/rest-api-spec.md`, or use
  [`@fibergate/sdk`](https://github.com/tiennt0212/FiberGate/tree/canary/packages/sdk)
  from your own storefront app instead of calling the REST API directly.
- **Register a webhook** from the dashboard to get notified when an invoice is paid.

## Upgrading

`fibergate-core`'s `pull_policy: always` means a plain `docker compose up -d` always
checks GHCR for a newer image under your configured tag (`:latest` by default)
before starting — you don't need to run `docker compose pull` separately first.
Combined with auto-migrate-on-boot, upgrading a deployment is just
`docker compose up -d` again. If you pinned `FIBERGATE_CORE_TAG` to a specific
`sha-xxx` instead of `latest`, this still re-checks every time but never actually
changes what's running until you edit that pin yourself.

## Something not covered here?

- **Want a public HTTPS domain for judges/customers to hit?** →
  [`public-https-deploy.md`](public-https-deploy.md)
- **Want full manual control over the generated files, or no Node.js on the deploy
  host itself?** → [`deployment.md`](deployment.md)
- **Want to see a real merchant integration end-to-end?** →
  [`demo-storefront.md`](demo-storefront.md)
- **Something failed during setup?** → [`../common/troubleshooting.md`](../common/troubleshooting.md)
