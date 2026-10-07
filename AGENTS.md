# AGENTS.md

Instructions for AI coding agents working on **OSI Time Tracker**. Humans start at [`README.md`](./README.md). The full coding rules are in [`docs/coding-standards.md`](./docs/coding-standards.md); this file wins on workflow, the standards win on style.

## Project overview

A self-hosted, multi-user time tracker for IT consultants. Each user has a fully isolated workspace. Time is tracked locally and exported on demand to remote issue trackers (OpenProject, Redmine). Server-side rendered with Nuxt.

- **App:** Nuxt 4, Vue 3 (`<script setup lang="ts">`), Nuxt UI 4 (Tailwind 4, Lucide icons), `@nuxtjs/i18n` (`en`, `pl`).
- **Server:** Nitro routes in `apps/web/server/api`, zod 4 boundary types, PostgreSQL 18 via Drizzle (`postgres` driver).
- **Security:** `nuxt-auth-utils` sealed cookie sessions, `nuxt-security` (CSRF, CSP, rate limiting).
- **Tooling:** pnpm workspace, Vite+ (`vp`: Vite, Vitest 5, Oxlint, Oxfmt) plus ESLint for Vue templates, a11y and i18n; Playwright for e2e.

### Domain

| Term            | Meaning                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tracker**     | A connection to a remote OpenProject/Redmine instance: type, base URL, direct-browser flag, rounding. Its API secret lives only in the browser. |
| **Project**     | A body of work; either bound to one Tracker (optionally scoped to a remote project) or local.                                                   |
| **Task**        | Derived, never managed directly: an entry's title _is_ its task. Tasks are auto-created, matched, renamed, merged and deleted from entry titles. |
| **Time entry**  | The object the user creates (timer or manual). A running timer is an entry without a stop time.                                               |
| **Remote sync** | The per-day page where tasks are linked to remote issues and selected time is exported. Export provenance never locks local entries.           |

### Hard constraints

- **Tracker API secrets never reach the OSI server.** All tracker calls run in the browser, directly or through the extension (`packages/extension-protocol`). Do not add server-side proxying or credential storage.
- **Remote calls are on demand only.** No background sync, polling or scheduled jobs against trackers.
- **Users are isolated.** Every query is scoped to the authenticated user.
- **Behavior is specified in `openspec/specs`.** Read the relevant spec before changing a feature, and keep spec and code aligned. Specs hold observable behavior only; tooling, build, CI and test-harness details live in `docs/` (`development.md`, `e2e-guideline.md`, `coding-standards.md`), and retired REQ codes in `docs/retired-requirements.md`.

## Commands

Use `pnpm` (or `pnpx` for one-off CLIs), never `npm`, `npx` or `yarn`. Run `pnpm install` again after pulling. Setting up the local environment (Docker, `.env`, database, local trackers) is a human task described in [`docs/development.md`](./docs/development.md); assume it is done.

```bash
pnpm dev             # dev server on http://localhost:3000
pnpm build           # production build (apps/web/.output)
pnpm build:packages  # build workspace libraries in dependency order (cached)
pnpm type-check      # builds the libraries, then type-checks every package
pnpm lint            # Oxlint, then ESLint
pnpm lint:fix        # auto-fix Oxlint and ESLint issues
pnpm format          # Oxfmt
pnpm format:check
pnpm db:generate     # new migration after a schema change (written to apps/migrator/migrations)
pnpm db:migrate      # apply pending migrations
```

### Vite+ (`vp`)

- `vp <name>` runs a built-in (`vp lint`, `vp fmt`, `vp test`); `vp run <name>` runs a `package.json` script. They differ here: `vp dev` is not `pnpm dev`, and root `vp test` runs only the anti-slop plugin tests. Prefer the `pnpm` scripts above.
- Root scripts drive packages with `vp run --filter …` in dependency order.
- `vp check` covers formatting and Oxlint only. It does **not** replace `pnpm lint`, `pnpm format:check` and `pnpm type-check`.
- `vp why <package>` explains the dependency graph; `vp env doctor` diagnoses runtime and package-manager problems. Docs: `node_modules/vite-plus/docs` or https://viteplus.dev/guide/.

### Upgrading dependencies

`vp outdated -r` lists what is behind. Each group moves through its own path, one commit per group:

- **Vite+** (`vite-plus`, the `vite` alias, `vitest`, `@vitest/coverage-v8`): upgrade the global CLI (`vp upgrade`), then run `vp migrate --no-interactive --no-agent --no-editor --no-hooks`. It re-pins the catalog and overrides together. A release younger than pnpm's minimum release age needs its packages in `minimumReleaseAgeExclude` first. Bump the `ghcr.io/voidzero-dev/vite-plus` tags in `Dockerfile` in the same commit.
- **Nuxt** (`nuxt`, `@nuxt/schema`): `vp -C apps/web add nuxt@<version>`, `vp -C apps/web add -D @nuxt/schema@<version>`, then `vp dedupe`. That is what `nuxt upgrade --dedupe` does, but `nuxt upgrade` calls `corepack pnpm` and fails against the pnpm that `vp` manages. Run `pnpm dev` and open a page before merging, because CI runs only on Linux.
- **Everything else:** `vp update -r <names>` within the current major.

Dependabot skips the Vite+ packages and image, and groups `nuxt` and `@nuxt/*` into one PR (`.github/dependabot.yml`).

## Testing

```bash
pnpm test:unit       # unit tests of every package + anti-slop plugin tests
pnpm test:nuxt       # component/integration tests (apps/web/test/nuxt, nuxt env)
pnpm test:e2e:db     # Postgres only: schema, migrator, server utils
pnpm test:e2e:api    # HTTP against a booted Nuxt server
pnpm test:e2e:ui     # Playwright journeys (needs Chromium)
pnpm test:e2e        # db + api + ui
pnpm test:e2e:dev    # api/ui against the Nuxt dev server (faster loop)
pnpm test:extension  # extension unit + unpacked browser tests (needs Chromium)
pnpm test:coverage   # Vitest v8 coverage for web unit + nuxt
pnpm test:coverage:e2e-db  # Vitest v8 coverage for the db e2e project (needs Docker)
pnpm package:check   # tracker/protocol packages without Nuxt
```

- Focus one test: from the package directory, `pnpm exec vp test run -t "<test name>"`.
- Test files are `*.spec.ts` under the matching `test/` project directory; e2e helper files are kebab-case.
- Which suite owns a failure: `apps/web/test/nuxt` = component with mocks; `apps/web/test/e2e/api` = HTTP contract; `apps/web/test/e2e/ui` = journey and production wiring.
- api/ui e2e use a production build against `postgres:18-alpine`. `NUXT_TEST_SKIP_BUILD=1` reuses `apps/web/.output`. Mutating specs seed a unique user per test. Missing Docker/Chromium skips locally and fails in CI.
- Remote trackers are always mocked (fake HTTP, `page.route`); there is no live tracker suite.
- Fix bugs test-first: a failing regression test before the fix, kept afterwards.
- Assert on `data-testid`, keep tests deterministic, and never weaken, skip or delete a test to get green.
- UI e2e waits for hydration after every full page load: `page.goto(…, { waitUntil: 'hydration' })` and `reloadHydrated(page)`, enforced by ESLint.
- E2E layout, coverage and known build pitfalls: [`docs/e2e-guideline.md`](./docs/e2e-guideline.md).

## Code style

Formatting is owned by Oxfmt (2 spaces, single quotes, semicolons, trailing commas, ~100 columns). The rules agents break most often:

1. No explicit `any`. A justified exception uses `// oxlint-disable-next-line typescript/no-explicit-any -- reason`. Every remaining `as` needs a `// SAFETY:` comment; `as unknown as` is forbidden in `app/`.
2. `catch (err)` without `: unknown`; narrow with `instanceof` on real classes (`FetchError`, `RemoteAdapterError`, `Error`) or a schema parse, not `isX` wrapper helpers.
3. Cross-boundary shapes are defined once in `apps/web/shared/types` as zod schemas (`camelCaseSchema`) with response types named `PascalCaseDto`; derive inputs with `z.infer`.
4. One `defineEventHandler` per route file (`name.<method>.ts`), typed with its DTO. Resolve the authenticated user first, validate with `readZodBody` / `getZodQuery`, and map `ZodError` to a `422` with `{ messageKey, params }` (never `received`).
5. The server never returns rendered text; clients translate `messageKey`. Timestamps cross the wire as ISO strings.
6. Database access only through `getDb()`, bound once per handler (`const db = getDb()`).
7. No hard-coded user-facing text: use `t(...)` and keep `en` and `pl` catalogs in parity.
8. Use Nuxt UI components over native elements. Dates use `UInputDate` (or its `range` variant), clock times the shared `TimeField`, free-text durations `DurationInput`; never `<input type="date">`.
9. Timezone math uses `Temporal`, and every display format passes the user's timezone (`useProfile().effective.timeZone`).
10. Destructure `defineProps()` when props are used in script; never assign it to a `props` object.
11. Accessibility targets WCAG 2.1 AA: labels, `aria-*`, keyboard operability, `UTooltip` instead of `title`.

## Project structure

```
apps/web/                     Nuxt app: app/, server/, shared/, i18n/, test/
apps/web/server/db/schema/    Drizzle schema (migrations live in apps/migrator)
apps/migrator/                Committed SQL migrations + one-shot runner (also the prod image)
apps/extension/               Chrome/Edge MV3 extension, built with Vite
apps/dev-seed/                Seeds local OpenProject/Redmine (`pnpm trackers:seed`)
packages/remote-trackers/     Provider adapters behind a neutral contract
packages/extension-protocol/  Message protocol shared by web app and extension
tools/oxlint/anti-slop/       Vendored Oxlint plugin (frozen, see below)
openspec/                     Specs (behavioral source of truth) and change proposals
docs/                         Self-hosting, development, coding standards, e2e guideline
```

## Anti-slop plugin is frozen

Never edit `tools/oxlint/anti-slop/` (rules, shared helpers, plugin entry) unless the developer explicitly asks. Fix the application code that a rule flags instead of changing or disabling the rule. Tests for the plugin may be added under `tools/oxlint/anti-slop/test/`, and `anti-slop/*` rules are enabled or disabled in the `lint` block of `vite.config.ts` only on request.

## Pull requests and commits

- PR titles follow Conventional Commits (checked in CI), with a scope when one fits: `feat(web): …`, `fix(remote-trackers): …`, `chore: …`.
- One logical change per commit. Tests and i18n catalogs change in the same commit as the code they cover.
- Before opening a PR: `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, and `pnpm test:e2e` when server behavior changes. After moving files or changing imports, re-run `pnpm lint`.
- Keep PRs focused and small.

## Security

- Never log or commit secrets (`.env`, session password, tracker API keys).
- Mutating endpoints rely on CSRF protection and the session; do not bypass `nuxt-security` settings.
- Optional `CONSOLA_LEVEL=4` logs every SQL statement when debugging the server.
