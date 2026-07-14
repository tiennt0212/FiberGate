# Release process

## `fibergate-core` (Docker image)

Published to GHCR automatically on every push to `canary` via
`.github/workflows/docker-publish.yml` (also runnable manually via
`workflow_dispatch` to test before trusting the automatic trigger). Two tags are
pushed:

- `sha-<short-sha>` — one per commit, for merchants who want to pin a specific,
  reproducible build (`FIBERGATE_CORE_TAG` in `.env`).
- `latest` — floating, always tracks `canary`'s HEAD.

No semver, no changelog process for this image at the current scope — the commit
SHA is enough to trace any deployed build back to its source. GHCR packages default
to **private** on first publish; someone with org-level access needs to flip the
package to public once via GitHub's UI (repo → Packages → fibergate-core → Package
settings) before `docker compose pull` will work for anyone outside the org.

## `create-fibergate` and `@fibergate/sdk` (npm packages)

Published automatically to npm by `.github/workflows/npm-publish.yml` (issue #56)
on every push to `canary` that touches `packages/create-fibergate/**` or
`packages/sdk/**` (also runnable manually via `workflow_dispatch` to test before
trusting the automatic trigger, same as the Docker image). Each package gets its
own job; a job only runs `npm publish` when that package's `package.json` version
differs from what's already published — maintainers still bump `version` by hand
in a PR, CI only handles the `npm publish` step once that change lands on `canary`.
For `@fibergate/sdk`, also bump the `SDK_VERSION` const in
`packages/sdk/src/index.ts` to match — it's not derived from `package.json`
automatically.

Auth is npm **Trusted Publishing** (OIDC) — no `NPM_TOKEN` secret stored or
rotated in this repo, matching `docker-publish.yml`'s "only the built-in
`GITHUB_TOKEN`" posture. This sidesteps the fact this project's npm account only
has passkey/security-key 2FA enrolled, which doesn't work non-interactively in CI.
**One-time manual setup required** (npm account owner only, can't be automated):
on npmjs.com, for each package's Settings page, add a Trusted Publisher pointing
at `tiennt0212/FiberGate` and the workflow file `.github/workflows/npm-publish.yml`.
`@fibergate/sdk` has never been published — if npm doesn't allow configuring a
Trusted Publisher before a package's first version exists, do one manual
`npm publish --auth-type=web` (browser approval flow, works around the passkey-only
2FA) from `packages/sdk` to create the package first, then set up Trusted
Publishing for every version after that.

Before publishing a new `create-fibergate` version (by hand or via CI), make sure
`pnpm --filter create-fibergate build` has run — its `prebuild` step
(`scripts/copy-templates.mjs`) copies `docker-compose.release.yml`,
`docker/fiber-node/config.yml`, `docker/nginx/nginx.conf.template`, and
`.env.release.example` from the repo root into `templates/` (gitignored) so the
scaffolded output can never silently drift from those files. The CI workflow runs
this automatically as part of its build step.

## Recording architecture/business decisions

Any non-trivial architecture, schema, or business-rule decision made during a
session — especially ones a human explicitly confirmed after being asked, per
`CLAUDE.md`'s "hỏi trước khi làm" rule — gets appended to
`.context/processes/decisions-log.md` in the same session, format:
`[YYYY-MM-DD] **Topic**: decision — Lý do: why`. Don't add entries there without an
explicit human confirmation in the conversation; it's a record of what was actually
decided, not a scratchpad for ideas. Ideas or future-work notes that aren't decided
yet belong in `.context/business-context/project-vision.md` or the Roadmap section
of `decisions-and-tradeoffs.md` instead.

If you change the database schema, keep
`.context/data-dictionary/database-schema.md` and `apps/web/lib/db/schema.ts` in
sync in the same change — see `CLAUDE.md`.
