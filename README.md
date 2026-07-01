# FiberGate

Self-hosted, open-source **merchant payment gateway** for the [Fiber Network](https://www.fiber.world) (CKB). Deploy it on your own infrastructure with `docker compose up -d`, then create invoices and receive payments over an internal REST API — without writing Fiber RPC glue, an invoice state machine, or webhook delivery yourself.

Single-tenant by design: one deployment serves one merchant, who keeps their own Fiber node key and data (self-custody).

> Built for the **Gone in 60ms: Fiber Network Infrastructure Hackathon** (category: Merchant, Liquidity, LSP, and Multi-Asset Infrastructure).

## What's inside

| Package | Description |
|---|---|
| `apps/web` | Next.js 14 app — admin dashboard + `/api/v1` REST API + in-process invoice poller + webhook delivery |
| `packages/sdk` | `@fibergate/sdk` — TypeScript client for creating invoices and verifying webhooks |
| `docker-compose.yml` | Fiber node (FNN) + PostgreSQL + fibergate-core |

## Quick start (self-host)

```bash
git clone <this-repo> && cd FiberGate
cp .env.example .env
# Fill in ADMIN_PASSWORD_HASH, SESSION_SECRET, FIBERGATE_INTERNAL_SECRET, FIBER_NODE_IMAGE
docker compose up -d
```

Then open `http://localhost:3000` and sign in with your admin password.

Generate the admin password hash:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'your-password'
```

Configure the bundled Fiber node in [`docker/fiber-node/`](docker/fiber-node/README.md).

## REST API

All `/api/v1/*` calls require `Authorization: Bearer $FIBERGATE_INTERNAL_SECRET`.
Responses use the envelope `{ data, error, meta? }`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/invoices` | Create an invoice |
| `GET` | `/api/v1/invoices/:id` | Get one invoice's status |
| `GET` | `/api/v1/invoices` | List invoices (`status`, `asset`, `limit`, `cursor`) |
| `GET` | `/api/v1/node/info` | Node identity + liquidity |
| `POST` | `/api/cron/poll-invoices` | Optional manual poll trigger (`Bearer $CRON_SECRET`) |

Full spec: [`.context/api/rest-api-spec.md`](.context/api/rest-api-spec.md).

## SDK usage

```bash
npm install @fibergate/sdk
```

```typescript
import { FiberGate, verify } from "@fibergate/sdk";

const gateway = new FiberGate({
  baseUrl: process.env.FIBERGATE_BASE_URL!,          // http://<host>:<port>
  internalSecret: process.env.FIBERGATE_INTERNAL_SECRET!,
});

const invoice = await gateway.invoices.create({ amount: 1.5, asset: "CKB" });

// In your webhook route handler — pass the RAW body:
const isValid = verify(rawBody, req.headers["x-fiber-signature"], webhookSecret);
```

## Development

```bash
pnpm install
pnpm dev                        # run apps/web
pnpm --filter web typecheck     # strict TS check
pnpm --filter @fibergate/sdk build
```

The database schema for local dev is in [`docker/postgres/init.sql`](docker/postgres/init.sql) (kept in sync with the Drizzle schema in `apps/web/lib/db/schema.ts`).

## Architecture & context

The full project context (vision, architecture, data dictionary, business rules, decisions) lives in [`.context/`](.context/INDEX.md).

## License

[MIT](LICENSE)
