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

## `create-fibergate` (npm package)

Published manually to npm as `create-fibergate` — currently at `0.1.2`. There is
**no CI/CD workflow that publishes this automatically** on version bump or tag;
someone runs `npm publish` by hand from `packages/create-fibergate` after bumping
`package.json`'s `version`. (`npm publish --auth-type=web` if your npm account only
has passkey/security-key 2FA enrolled — opens a browser approval flow instead of
prompting for a TOTP code.)

Before publishing a new version, make sure `pnpm --filter create-fibergate build`
has run — its `prebuild` step (`scripts/copy-templates.mjs`) copies
`docker-compose.release.yml`, `docker/fiber-node/config.yml`,
`docker/nginx/nginx.conf.template`, and `.env.release.example` from the repo root
into `templates/` (gitignored) so the scaffolded output can never silently drift
from those files.

## `@fibergate/sdk` (npm package)

**Not currently published to npm at all** — consumed only via pnpm workspace
linking (e.g. by `apps/demo-storefront`). Anyone wanting to use it from outside this
monorepo today would need to build it (`pnpm --filter sdk build`) and either publish
it themselves or vendor the built output.

> Automating both of the above (npm publish on tag/version-bump, for both
> `create-fibergate` and `@fibergate/sdk`) is a known gap — see the Roadmap section
> of [`../decisions-and-tradeoffs.md`](../decisions-and-tradeoffs.md).

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
