/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required so `docker/fibergate-core/Dockerfile` can copy `.next/standalone` — self-hosted
  // merchants run this container as a long-lived Node process (`node server.js`),
  // not a serverless function. See docker-compose.yml / docker/fibergate-core/Dockerfile.
  output: 'standalone',
  experimental: {
    // apps/web/instrumentation.ts (BR-POL-001's startup hook for the invoice
    // poller) is still gated behind this flag on the pinned next@14.2.35 —
    // verified directly against the installed package, not assumed from a
    // different version's docs: node_modules/next/dist/server/config-shared.js
    // defaults instrumentationHook to `false`, and
    // node_modules/next/dist/build/index.js only detects instrumentation.ts
    // when this is truthy. Revisit this flag/comment on the next Next.js
    // major upgrade (later versions stabilize this without the flag).
    instrumentationHook: true,
  },
}

module.exports = nextConfig
