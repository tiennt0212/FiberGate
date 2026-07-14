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

`@fibergate/sdk` is a **scoped** package (`@fibergate/*`), which npm only allows
under either your own username as scope, or an npm **Organization** named exactly
`fibergate` — this project's npm account is `tiennt0212`, not `fibergate`, so the
org doesn't exist automatically. Confirmed via `npm org ls fibergate` → `404 Scope
not found`: the name is free, but someone with admin access needs to create it once
on npmjs.com (Organizations → Create Organization → `fibergate`, free tier is fine
since the package publishes with `publishConfig.access: "public"`) before
`@fibergate/sdk` can be published at all. `create-fibergate` is unscoped and needs
no org — it publishes straight under the personal account.

Auth is npm **Trusted Publishing** (OIDC) — no `NPM_TOKEN` secret stored or
rotated in this repo, matching `docker-publish.yml`'s "only the built-in
`GITHUB_TOKEN`" posture. This sidesteps the fact this project's npm account only
has passkey/security-key 2FA enrolled, which doesn't work non-interactively in CI.
**One-time manual setup required** (npm account owner only, can't be automated):
on npmjs.com, for each package's Settings page, add a Trusted Publisher pointing
at `tiennt0212/FiberGate` and the workflow file `.github/workflows/npm-publish.yml`.
`@fibergate/sdk` has never been published, and Trusted Publisher is configured
per-*package* (not per-org) on a Settings page that only exists once the package
does — so the order for its first release is: create the `fibergate` org above →
one manual `npm publish --auth-type=web` (browser approval flow, works around the
passkey-only 2FA) from `packages/sdk` to create the package under that org → *then*
add the Trusted Publisher for every CI-driven version after that.

Before publishing a new `create-fibergate` version (by hand or via CI), make sure
`pnpm --filter create-fibergate build` has run — its `prebuild` step
(`scripts/copy-templates.mjs`) copies `docker-compose.release.yml`,
`docker/fiber-node/config.yml`, `docker/nginx/nginx.conf.template`, and
`.env.release.example` from the repo root into `templates/` (gitignored) so the
scaffolded output can never silently drift from those files. The CI workflow runs
this automatically as part of its build step.

## If repo/npm org ownership changes later (e.g. hackathon handover)

Both publish workflows above bind to *specific* identities that don't move
automatically if this repo or the `fibergate` npm org gets transferred to another
owner (e.g. handed over to hackathon organizers post-submission):

- **GHCR image name follows the repo owner.** `docker-publish.yml`'s
  <code v-pre>IMAGE_NAME: ${{ github.repository_owner }}/fibergate-core</code> resolves at build
  time — a repo transfer flips the published image from
  `ghcr.io/tiennt0212/fibergate-core` to `ghcr.io/<new-owner>/fibergate-core`.
  Every place that references the old name (`docker-compose.release.yml`,
  `.env.release.example`, merchant-facing docs) needs updating to match.
- **npm Trusted Publishing needs re-linking.** Each package's Trusted Publisher
  config on npmjs.com is bound to the exact `<owner>/<repo>` string plus the
  workflow filename (see above) — it does **not** follow a repo transfer.
  `npm-publish.yml` will fail auth on the next run after a transfer until someone
  with admin access on each package (`create-fibergate`, `@fibergate/sdk`) removes
  the old Trusted Publisher and adds one pointing at the new owner/repo.
- **Package/org ownership on npm itself is separate from CI auth** and needs its
  own transfer if the new owner should be able to `npm publish` by hand too:
  `npm owner add <new-account> <package>` then `npm owner rm tiennt0212 <package>`
  per package, or — to hand over everything under `@fibergate/*` at once — add the
  new account as an Owner in the `fibergate` org's Settings on npmjs.com, then
  remove the original owner's Owner role there.

Noted while setting up npm publishing for the first time (issue #56) so this isn't
a surprise later — not a decision that's been made, just an operational runbook for
if/when it happens.

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
