# fibergate-core — Next.js 14 (apps/web) standalone build.
#
# Build context MUST be the repo root (pnpm workspace), not apps/web:
#   docker build -f docker/fibergate-core/Dockerfile .
# docker-compose.yml's fibergate-core service sets build.dockerfile accordingly.

# ---- deps: install workspace dependencies with a frozen lockfile ----
FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable

# Only manifests first, so `pnpm install` is cached unless dependencies change.
# pnpm needs every workspace package's manifest present (per pnpm-workspace.yaml
# globs: apps/*, packages/*) to resolve the lockfile, even if apps/web doesn't
# currently depend on @fibergate/sdk.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/sdk/package.json packages/sdk/package.json

RUN pnpm install --frozen-lockfile

# ---- builder: build the web app ----
FROM node:20-alpine AS builder
WORKDIR /repo
RUN corepack enable

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages/sdk/node_modules ./packages/sdk/node_modules
COPY . .

RUN pnpm --filter web build

# ---- runner: minimal image, Next.js standalone output only ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `output: 'standalone'` (apps/web/next.config.js) traces only the files needed
# at runtime. In a monorepo this mirrors the workspace path, so server.js lands
# at apps/web/server.js. .next/static and public/ are not included by the
# tracer and must be copied in manually (Next.js standalone docs).
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
