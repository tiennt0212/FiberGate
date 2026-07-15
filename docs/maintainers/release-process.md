# Release process

How each FiberGate artifact gets published. Most of it is automatic on a push to `canary`; the manual
parts are one-time account setup, called out where they apply.

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

Both publish to npm via `.github/workflows/npm-publish.yml` (issue #56) on any push to `canary` that
touches their package directory — or manually via `workflow_dispatch`. Each package has its own job,
and a job only runs `npm publish` when its `package.json` version differs from what's already on npm.

So the everyday release flow is: **bump `version` by hand in a PR; CI publishes once it lands on
`canary`.** For `@fibergate/sdk`, also bump the `SDK_VERSION` constant in `packages/sdk/src/index.ts`
to match — it isn't derived from `package.json` automatically.

### First-time npm setup (one-time, npm account owner only)

These are account-level actions on npmjs.com that can't be automated:

1. **Create the `fibergate` org** — needed only for the scoped `@fibergate/sdk`. npm allows a scoped
   package (`@fibergate/*`) only under a matching username or org, and this project's account is
   `tiennt0212`. Create it once (Organizations → Create Organization → `fibergate`; the free tier is
   fine, since the package publishes with public access). `create-fibergate` is unscoped and needs
   none of this.
2. **Publish `@fibergate/sdk` once by hand** to create the package: `npm publish --auth-type=web` from
   `packages/sdk`. The browser approval flow works around this account's passkey-only 2FA (which can't
   run non-interactively in CI).
3. **Add a Trusted Publisher** for each package, on its own npmjs.com Settings page, pointing at
   `tiennt0212/FiberGate` and the workflow file `.github/workflows/npm-publish.yml`. This is what lets
   CI publish with no stored `NPM_TOKEN` (auth is OIDC / npm Trusted Publishing, matching the Docker
   workflow's "built-in `GITHUB_TOKEN` only" posture). It's configured per-package on a page that only
   exists once the package does — which is why step 2 comes first.

### Before publishing a new `create-fibergate`

Make sure `pnpm --filter create-fibergate build` has run first — its `prebuild` step
(`scripts/copy-templates.mjs`) copies `docker-compose.release.yml`, the fiber-node config, the nginx
template, and `.env.release.example` into `templates/` so the scaffolded output can never silently
drift from those files. CI does this automatically as part of its build.

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
