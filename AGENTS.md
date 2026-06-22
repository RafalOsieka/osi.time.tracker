<!-- FOR AI AGENTS - Human readability is a side effect, not a goal -->
<!-- Managed by agent: keep sections concise; document only what exists. Mark not-yet-built items as Planned. -->
<!-- Last verified: 2026-06-22 against package.json, eslint.config.mjs, AGENTS.md, app/pages/login.vue, openspec/changes/add-accessibility-standard/ -->

# AGENTS.md

**OSI Time Tracker** (`osi.time.tracker`) is a self-hosted, open-source personal time tracking web application for IT specialists working across multiple clients and projects. It supports a structured Client → Project → Task hierarchy, a live timer and manual time entry, and on-demand push of time entries to external issue trackers (Redmine, OpenProject) via a dual-mode adapter model.

> **Status:** Early MVP. The repo is a Nuxt 4 + PrimeVue starter with a server-side database persistence layer (PostgreSQL via Drizzle ORM) now in place. Most domain features below are still **planned** (see `docs/wbs.md`), not yet implemented. Document only what exists; mark future work as Planned.

## Commands
> Package manager: **pnpm** (`^11.6.0`, see `devEngines` in `package.json`). Source: `package.json` scripts.

| Task | Command | Notes |
|------|---------|-------|
| Install deps | `pnpm install` | runs `nuxt prepare` via `postinstall` |
| Dev server | `pnpm dev` | serves on `http://localhost:3000` |
| Build | `pnpm build` | `nuxt build` |
| Static generate | `pnpm generate` | `nuxt generate` |
| Preview prod build | `pnpm preview` | `nuxt preview` |
| Unit tests | `pnpm test:unit` | Vitest `unit` project, `node` env, `test/unit/*.{test,spec}.ts` |
| E2E tests | `pnpm test:e2e` | Vitest `e2e` project, `node` env, `test/e2e/*.{test,spec}.ts` |
| Nuxt tests | `pnpm test:nuxt` | Vitest `nuxt` project, `nuxt` env, `test/nuxt/*.{test,spec}.ts` |
| Generate migrations | `pnpm db:generate` | `drizzle-kit generate` — diffs `server/db/schema/*.ts` into `server/db/migrations` |
| Apply migrations | `pnpm db:migrate` | `tsx server/db/migrate.ts` — applies pending migrations; needs `DATABASE_URL` |
| Lint | `pnpm lint` | `eslint .` — needs `nuxt prepare` (run via `postinstall`) first |
| Lint & fix | `pnpm lint:fix` | `eslint . --fix` |
| Format | `pnpm format` | `prettier --write .` |
| Check formatting | `pnpm format:check` | `prettier --check .` |

> Test runner: **Vitest 4** with `@nuxt/test-utils` (multi-project config in `vitest.config.ts`). Database persistence tests exist: `test/unit/db-client.spec.ts` and `test/e2e/db.spec.ts` (the e2e suite spins up PostgreSQL via Docker and **skips itself when Docker is unavailable** — see `test/e2e/support/postgres.ts`). The `nuxt` project still has no specs. `DATABASE_URL` must be set (see `.env.example`) for DB code/tests to run.

> Linting & formatting: **ESLint 9** flat config (`eslint.config.mjs`, built on `@nuxt/eslint` via `withNuxt()` + `eslint-config-prettier`) and **Prettier 3** (`.prettierrc.json`: single quotes, semicolons, `printWidth` 100, `tabWidth` 2, `trailingComma: all`, `endOfLine: lf`). `pnpm lint`/`pnpm lint:fix` require `nuxt prepare` to have generated `.nuxt/eslint.config.mjs` first (runs via `postinstall`). ESLint ignores `.nuxt`, `.output`, `node_modules`, `dist`, and `server/db/migrations`; Prettier ignores paths via `.prettierignore`. Keep `eslint-config-prettier` appended **last** so Prettier owns stylistic rules. No typecheck script is configured yet; add tooling (and document it here) before relying on it.

> Database access: all server-side DB access goes through the shared lazy `db` client exported from `server/db/index.ts` (backed by `postgres.js` + Drizzle); never instantiate raw drivers directly. `DATABASE_URL` is also exposed server-only via `runtimeConfig.databaseUrl` in `nuxt.config.ts`.

> Authentication: server-side session auth via **`nuxt-auth-utils`** — a sealed, `HttpOnly`, `SameSite=Strict` cookie (`Secure` in production) with a fixed lifetime (`runtimeConfig.session.maxAge`, 1 week). Requires `NUXT_SESSION_PASSWORD` (32+ chars, see `.env.example`); production startup fails fast if it is missing. Login/logout/session endpoints live under `server/api/auth/*`; protect private endpoints with the `requireAuth` helper (`server/utils/auth.ts`, wrapping `requireUserSession`). **`nuxt-security`** adds CSRF protection (mutating methods need the `csrf-token` header — use the `$csrfFetch`/`useCsrfFetch` helpers client-side) plus baseline security headers (incl. CSP). The client reads login state via `useUserSession` (wrapped by `app/composables/useAuth.ts`).

## Technology

| Component     | Technology                              | State     |
| ------------- | --------------------------------------- | --------- |
| Frontend / API| Nuxt 4, Vue 3, TypeScript               | present   |
| UI Library    | PrimeVue 4 (`@primevue/nuxt-module`, Aura preset) | present   |
| Testing       | Vitest 4, `@nuxt/test-utils`, `@vue/test-utils`, happy-dom, playwright-core | present   |
| Database      | PostgreSQL via Drizzle ORM (`drizzle-orm`, `postgres`, `drizzle-kit`, `tsx`) | present   |
| Auth / Security | `nuxt-auth-utils` (session cookie) + `nuxt-security` (CSRF, CSP/headers) | present   |
| Lint / Format | ESLint 9 (`@nuxt/eslint`, `eslint-config-prettier`) + Prettier 3 | present   |
| Deployment    | Docker / Docker Compose                 | planned   |
| Styling       | Tailwind CSS (optional)                 | planned   |
| PWA           | Nuxt PWA module (service worker, offline cache) | planned   |

> "present" = installed/configured in `package.json` + `nuxt.config.ts` / `vitest.config.ts`. "planned" = target architecture from `docs/vision.md`, not yet added.

## Architecture (target)

- **Frontend / Backend:** Nuxt 4 — server routes serve as the API layer; no separate backend service in MVP.
- **Database:** PostgreSQL — all user data is stored server-side; each user's data is strictly isolated.
- **Adapter model:** Remote integrations are adapters (one per system type). Each adapter runs in **backend-side** mode (server-to-server, public systems) or **client-side** mode (browser-to-remote, VPN-protected systems). The interface is identical in both modes.
- **PWA:** Nuxt PWA module provides a service worker and offline cache; timer state persisted locally.
- **Deployment:** Docker Compose — full stack (app + database) started with `docker compose up`.

## Domain

Core hierarchy: **User → Client → Project → Task → TimeEntry**

| Term                   | Meaning                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Client**             | A company or person the user works for; top-level grouping for projects; holds `RemoteSystemConfig`.           |
| **RemoteSystemConfig** | Config for a remote issue tracker on a Client: system type, base URL, API credentials, adapter mode, rounding. |
| **Task**               | Unit of work inside a Project; may hold a `RemoteIssueRef` linking it to a remote issue.                       |
| **RemoteIssueRef**     | Lightweight link on a Task: stores only the remote issue ID and cached metadata (title, URL).                  |
| **TimeEntry**          | A logged time interval (start + end or duration) attached to a Task; can be pushed to a remote system.         |
| **Adapter**            | Plugin implementing integration with one remote system (Redmine, OpenProject, …); follows a stable interface.  |
| **Rounding Rule**      | Configurable rule applied to a TimeEntry duration before pushing (e.g. round up to nearest 15 minutes).        |

## Key Constraints

| Constraint    | Detail                                                              |
| ------------- | ------------------------------------------------------------------- |
| Security      | OWASP Top 10, rate limiting, CSP headers                            |
| Feature scope | 🔴 MVP · 🟡 V1.1 · 🟢 Backlog · ⚫ Out of scope – see `docs/wbs.md` |

## Repository Structure

| Path | Contents |
| --------------------------- | ----------------------------------------------------- |
| `app/` | Nuxt app source (`app.vue` entry) |
| `nuxt.config.ts` | Nuxt + PrimeVue configuration |
| `vitest.config.ts` | Vitest multi-project config (unit / e2e / nuxt) |
| `eslint.config.mjs` | ESLint flat config (`@nuxt/eslint` + `eslint-config-prettier`) |
| `.prettierrc.json` | Prettier formatting rules |
| `.prettierignore` | Paths excluded from Prettier |
| `drizzle.config.ts` | Drizzle Kit config (schema `server/db/schema/*.ts`, out `server/db/migrations`) |
| `.env.example` | Sample env (`DATABASE_URL`, `NUXT_SESSION_PASSWORD`) |
| `server/db/` | Drizzle client (`client.ts`, `index.ts`) + migrator (`migrate.ts`) |
| `server/db/schema/` | Drizzle table schemas (`*.ts`) |
| `server/db/migrations/` | Generated SQL migrations |
| `test/` | Vitest test sources (`unit/`, `e2e/`; `nuxt/` empty) |
| `public/` | Static assets served as-is |
| `docs/vision.md` | System overview, domain model, roles, lifecycle, NFRs |
| `docs/wbs.md` | Feature list with priorities |
| `openspec/config.yaml` | OpenSpec workflow rules  |
| `openspec/specs/` | Behavioral specs – source of truth |
| `openspec/changes/archive/` | Archived change proposals |
| `openspec/changes/**/` | Active change proposals |

> OpenSpec project context lives in this file; `openspec/config.yaml` holds only workflow rules (spec/proposal/design/tasks/verify).

## Current Phase

- [x] Technical business specification + OpenSpec initialization.
- [x] MVP - Work In Progress.
- [ ] MVP - Finished.

## Internationalization (i18n)

**Standard**: `@nuxtjs/i18n` (vue-i18n), `strategy: 'no_prefix'`, two locales from day one: `en` (default) and `pl` (see `openspec/specs/internationalization/spec.md` and `docs/wbs.md` 8.4).

**Locale resolution** (precedence): cookie `i18n_locale` → `Accept-Language` header → default `en`. Cookie is `SameSite=Lax`, `Secure` in production, not `HttpOnly`. No `locale` column on the user yet — deferred to User Settings (WBS 7.4).

**Catalog layout**: `i18n/locales/{en,pl}.json`, nested namespaces:
- `auth.*` — login page strings
- `home.*` — home page strings
- `layout.*` — default layout strings (title, logout button)
- `errors.*` — server-returned message keys (see server contract below)

**Server `messageKey` contract**: API error responses carry `{ messageKey: string, params?: Record<string, unknown> }` (type: `server/types/api-message.ts`). The server never returns rendered locale-specific text; the client translates via `t(messageKey, params)`. Server keys live under the reserved `errors.*` namespace — renames are a deliberate contract change. Use `extractMessageKey(err)` (`app/utils/extractMessageKey.ts`) to safely extract the key from a caught error.

**Lint gate**: `@intlify/eslint-plugin-vue-i18n` in `eslint.config.mjs` (before `eslint-config-prettier`), `no-raw-text` at `error` severity. `pnpm lint` fails on raw literal strings in component templates. Heading elements (`h1`–`h6`) are excluded by the plugin's default `ignoreNodes`. Run `pnpm lint` (must pass; justify disables with comments).

**No hardcoded strings policy**: All user-facing UI strings must come from `i18n/locales/`. Use `t('key')` in `<script setup>` (import `useI18n` from `vue-i18n` explicitly) and `{{ t('key') }}` in templates. Catalog parity between `en.json` and `pl.json` is enforced by `test/unit/i18n-catalog-parity.spec.ts`.

Last verified: 2026-06-22 (added i18n infrastructure, en+pl catalogs, lint gate).

## Accessibility

**Standard**: WCAG 2.1 Level AA (see `openspec/specs/accessibility/spec.md` and `docs/wbs.md` 8.5).

**Lint gate**: `eslint-plugin-vuejs-accessibility` flat/recommended (in `eslint.config.mjs`, before prettier).

**Per-PR checklist**:
- Every interactive control has associated visible label (no placeholder-only names).
- Form errors announced via live region (`role="alert"`) + `aria-describedby`/`aria-invalid`.
- Keyboard operable, visible focus, no traps.
- AA contrast; state not conveyed by color alone.
- Run `pnpm lint` (must pass; justify disables with comments).

Last verified: 2026-06-22 (added a11y plugin + initial UI fixes).

## Language

All text files (documentation, diagrams, ADRs, specs) must be in English.
