/** @type {import('next').NextConfig} */
const nextConfig = {
  // Same reasoning as apps/web/next.config.js: Dockerfile runs this as a
  // long-lived Node process (`node server.js`), not a serverless function,
  // and copies `.next/standalone`.
  output: 'standalone',
  // Required by @fiber-pay/react's browser WASM runtime (SharedArrayBuffer,
  // multithreaded WASM) — without these two headers, the in-browser Fiber
  // node (BrowserWalletPay.tsx) fails to start. Per @fiber-pay/react's own
  // README: apply site-wide, not just to the checkout route, since Next.js
  // dev/prod both need this at the HTTP layer (not just at the Vite-dev-only
  // level their docs show for a Vite app).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
