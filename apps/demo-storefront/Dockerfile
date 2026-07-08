# demo-storefront — Next.js 14 (apps/demo-storefront) standalone build.
# Reference merchant app: a genuinely separate consumer of @fibergate/sdk
# that talks to fibergate-core only over the network (FIBERGATE_BASE_URL /
# FIBERGATE_INTERNAL_SECRET), never sharing code with apps/web. See
# docker-compose.demo.yml — this is NOT part of the merchant-facing
# docker-compose.yml bundle.
#
# Build context MUST be the repo root (pnpm workspace), not apps/demo-storefront:
#   docker build -f apps/demo-storefront/Dockerfile .
# apps/demo-storefront/docker-compose.demo.yml's demo-storefront service sets
# build.context/build.dockerfile accordingly.

# ---- deps: install workspace dependencies with a frozen lockfile ----
FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable

# pnpm needs every workspace package's manifest present (per
# pnpm-workspace.yaml globs: apps/*, packages/*) to resolve the lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/demo-storefront/package.json apps/demo-storefront/package.json
COPY packages/sdk/package.json packages/sdk/package.json

RUN pnpm install --frozen-lockfile

# ---- builder: build the SDK (dependency), then the demo app ----
FROM node:20-alpine AS builder
WORKDIR /repo
RUN corepack enable

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/demo-storefront/node_modules ./apps/demo-storefront/node_modules
COPY --from=deps /repo/packages/sdk/node_modules ./packages/sdk/node_modules
COPY . .

# apps/demo-storefront imports @fibergate/sdk's built dist/ output (workspace
# link resolves through package.json's main/module/types, not TS source).
RUN pnpm --filter sdk build
RUN pnpm --filter demo-storefront build

# ---- runner: minimal image, Next.js standalone output only ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `output: 'standalone'` (apps/demo-storefront/next.config.js) traces only
# the files needed at runtime. In a monorepo this mirrors the workspace
# path, so server.js lands at apps/demo-storefront/server.js. .next/static
# and public/ are not included by the tracer and must be copied in manually
# (Next.js standalone docs) — same pattern as docker/fibergate-core/Dockerfile.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/demo-storefront/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/demo-storefront/.next/static ./apps/demo-storefront/.next/static

USER nextjs
EXPOSE 3001

CMD ["node", "apps/demo-storefront/server.js"]
