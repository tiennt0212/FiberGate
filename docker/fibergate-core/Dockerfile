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

# Stage the 2 packages apps/web/scripts/migrate.mjs needs at runtime
# (drizzle-orm, postgres — both zero-runtime-dependency packages, ~16MB
# total) into a plain, non-symlinked directory. The standalone output above
# does NOT include these: Next's webpack bundler inlines pure-JS deps like
# these directly into the compiled route bundles rather than keeping them as
# separate node_modules entries, so they aren't resolvable by a sibling
# script outside that bundle. `cp -rL` dereferences pnpm's node_modules
# symlinks so the runner stage below can COPY this without needing pnpm's
# versioned virtual-store directory names (which change on every version
# bump / lockfile update).
RUN mkdir -p /migrator/node_modules && \
    cp -rL apps/web/node_modules/drizzle-orm /migrator/node_modules/drizzle-orm && \
    cp -rL apps/web/node_modules/postgres /migrator/node_modules/postgres

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

# Auto-migrate on boot (see apps/web/scripts/migrate.mjs) — merchants never
# run a manual migrate step, on first install or a later version upgrade
# (drizzle-orm tracks applied migrations, so this is a fast no-op when
# there's nothing new to apply).
COPY --from=builder --chown=nextjs:nodejs /migrator/node_modules ./apps/web/node_modules
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/lib/db/migrations ./apps/web/lib/db/migrations
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/scripts/migrate.mjs ./apps/web/scripts/migrate.mjs

USER nextjs
EXPOSE 3000

# `exec` replaces the shell with the server process so it receives SIGTERM
# directly (graceful shutdown) instead of the shell swallowing it as PID 1.
# If migrate.mjs exits non-zero, `&&` short-circuits and the server never
# starts — a failed migration should be a loud, visible container exit, not
# a silent boot into a broken schema.
CMD ["sh", "-c", "node apps/web/scripts/migrate.mjs && exec node apps/web/server.js"]
