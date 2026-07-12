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

# next build's "Collecting page data" step evaluates lib/db/index.ts and
# lib/fiber/client.ts at module load time (both build a connection
# string/client eagerly, per their own "singleton built at import time"
# comments) -- requireEnv() throws if these aren't set, even though no real
# DB/Fiber connection is ever made during build. Real values only matter at
# container *runtime*: docker-compose's environment: block re-evaluates
# these modules fresh the moment `node apps/web/server.js` actually starts,
# completely independent of whatever was used here. These ARG defaults are
# never shipped in the final image (the runner stage below only copies
# .next/standalone, .next/static, and public/) -- they exist purely to
# satisfy the build-time import.
#
# Note: dotenv-cli (invoked by `pnpm build` below) does not override an
# already-set process.env value, so these ENV defaults intentionally take
# precedence over a real .env file present in the build context (e.g. a
# contributor's local `docker compose build`) -- harmless, since the build
# never uses the value for anything beyond satisfying requireEnv().
ARG POSTGRES_USER=build
ARG POSTGRES_PASSWORD=build
ARG POSTGRES_HOST=build
ARG POSTGRES_PORT=5432
ARG POSTGRES_DB=build
ARG FIBER_NODE_URL=http://build:8227
ENV POSTGRES_USER=$POSTGRES_USER \
    POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
    POSTGRES_HOST=$POSTGRES_HOST \
    POSTGRES_PORT=$POSTGRES_PORT \
    POSTGRES_DB=$POSTGRES_DB \
    FIBER_NODE_URL=$FIBER_NODE_URL

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
