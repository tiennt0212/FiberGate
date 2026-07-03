/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required so `docker/fibergate-core/Dockerfile` can copy `.next/standalone` — self-hosted
  // merchants run this container as a long-lived Node process (`node server.js`),
  // not a serverless function. See docker-compose.yml / docker/fibergate-core/Dockerfile.
  output: 'standalone',
}

module.exports = nextConfig
