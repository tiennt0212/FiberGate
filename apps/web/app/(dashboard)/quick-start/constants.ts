// Code snippets shown on the Quick Start page. Kept out of the component so the
// copy is easy to maintain (and update) without touching JSX.

export const DEPLOY_SNIPPET = `cp .env.example .env
# set ADMIN_PASSWORD, FIBERGATE_INTERNAL_SECRET, DATABASE_URL, FIBER_NODE_URL
docker compose up -d`;

export const INSTALL_SNIPPET = `npm install @fibergate/sdk`;

export const CREATE_INVOICE_SNIPPET = `import { FiberGate } from '@fibergate/sdk'

const gateway = new FiberGate({
  baseUrl: process.env.FIBERGATE_BASE_URL,
  internalSecret: process.env.FIBERGATE_INTERNAL_SECRET,
})

const invoice = await gateway.invoices.create({
  amount: 1,
  asset: 'CKB',
  description: 'Order #123',
})`;

export const VERIFY_WEBHOOK_SNIPPET = `const isValid = gateway.webhooks.verify(rawBody, signature, secret)`;
