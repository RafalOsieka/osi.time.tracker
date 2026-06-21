## Context

The entire UI is a single `app/app.vue` (~80 lines) that inlines the login form, logout button, and auth-status text, branching on `loggedIn`. There is no `<NuxtPage />`, so Nuxt's file-based router is dormant and `app/pages/`, `app/layouts/`, and `app/middleware/` do not exist.

The authentication backend is already complete: `app/composables/useAuth.ts` wraps `useUserSession` and exposes `loggedIn`, `user`, `login`, `logout`, `refresh`; login/logout go through `$csrfFetch` against `server/api/auth/*`. The session cookie (`nuxt-auth-utils`) is readable server-side, and CSRF/headers come from `nuxt-security` (see `nuxt.config.ts` and `openspec/specs/authentication/spec.md`). This change is purely **frontend page/routing architecture** — no server code moves.

## Goals / Non-Goals

**Goals:**
- Activate the file-based router so any new page under `app/pages/` is routed automatically.
- Provide two layouts (`auth`, `default`) as the persistent shells for current and future pages.
- Protect every route private-by-default via one global SSR guard, with deep-link preservation and no login flash.
- Preserve all existing `data-testid` hooks on their new locations.

**Non-Goals:**
- Nav menu items, running-timer indicator (WBS 2.9), theme/i18n switching (WBS 7.4/7.6), custom 404/error pages.
- Any change to the authentication backend, session, or CSRF behavior.

## Decisions

- **Two layouts over a single conditional layout.** `auth.vue` (centered card) and `default.vue` (app shell: header with brand + reserved nav/timer slot + logout, then `<slot />`). *Alternative:* one layout with `v-if` branching — rejected because it reintroduces the `app.vue`-style branching that does not scale to Clients/Reports/Settings and the running-timer indicator.
- **Private-by-default global middleware.** `app/middleware/auth.global.ts` treats every route as private unless the page declares `definePageMeta({ public: true })`. *Alternative:* opt-in per-page guards — rejected as error-prone (easy to forget, fails open).
- **SSR guard reading `useUserSession().loggedIn`.** Resolves the redirect server-side before paint, avoiding a login flash; the guard must not touch `window`/`localStorage`. *Alternative:* client-only guard — rejected because it flashes protected markup for a frame.
- **Deep-link preservation via `?redirect=`.** The guard stashes `to.fullPath` on redirect to login; login and the authenticated-on-`/login` case navigate back to it. A sanitizer accepts only same-origin relative paths (must start with a single `/`, not `//`) to prevent open redirects.
- **Logout relocates into `default.vue` header.** Present on every authenticated page for free; co-located with the future timer slot. *Alternative:* keep per-page logout — rejected as duplication.

## Risks / Trade-offs

- **Browser-only APIs in the guard break SSR** → rely solely on `useUserSession`; no `window`/`localStorage` references.
- **Open redirect via `?redirect=`** → sanitize: honor only paths starting with a single `/`; otherwise fall back to `/`.
- **Layout-resolution regressions drop styling/testids** → preserve all `data-testid` hooks and the existing card styling when moving markup out of `app.vue`; cover with `test/nuxt/` specs.

## Migration Plan

Incremental, no data migration: (1) slim `app.vue` + add empty layouts; (2) move login into `app/pages/login.vue`; (3) add `app/pages/index.vue` + relocate logout into `default.vue`; (4) add the guard; (5) add `test/nuxt/` specs. Rollback is reverting the new files and restoring `app.vue`.

## Open Questions

- None. All design decisions were confirmed with the user during exploration.
