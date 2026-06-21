## Why

The entire UI lives in a single hardcoded `app/app.vue` that inlines the login form and logout action and branches on `loggedIn`. There is no `<NuxtPage />`, so Nuxt's file-based router is dormant and no new page can be added without growing this monolith. The MVP (WBS 1.1) needs a real page architecture that makes every future page routed and protected by default.

## What Changes

- Activate the file-based router: reduce `app.vue` to `<NuxtRouteAnnouncer /> + <NuxtLayout><NuxtPage /></NuxtLayout>`.
- Add two layouts: `auth` (centered login card, no nav) and `default` (app shell: header with brand, reserved nav/running-timer slot, and logout).
- Add two pages: `login.vue` (auth layout, public) and `index.vue` (default layout, authenticated welcome placeholder).
- Add one global middleware `auth.global.ts` implementing **private-by-default** route protection that resolves during SSR (no login flash) and preserves deep links via `?redirect=`.
- Relocate the logout action from the page into the `default` layout header.
- Preserve all existing `data-testid` hooks on their new locations.

## Capabilities

### New Capabilities
- `frontend-pages`: File-based routing shell, the `auth`/`default` layouts, the public login page and authenticated home page, and the private-by-default SSR navigation guard with redirect preservation.

### Modified Capabilities
<!-- None: the authentication backend spec is unchanged; this is purely frontend page/routing architecture. -->

## Impact

- **Code**: `app/app.vue` (slimmed); new `app/layouts/auth.vue`, `app/layouts/default.vue`, `app/pages/login.vue`, `app/pages/index.vue`, `app/middleware/auth.global.ts`. `app/composables/useAuth.ts` unchanged.
- **Tests**: new specs under `test/nuxt/` (currently empty) covering the redirect matrix and layout/testid wiring.
- **Backend/APIs**: none — `server/api/auth/*`, session cookie, and CSRF are untouched.

## Non-goals

- Nav menu items (no Clients/Reports/Settings pages exist yet) — only a reserved header slot.
- Running-timer indicator implementation (WBS 2.9) — only a reserved slot.
- Theme / i18n switching (WBS 7.4 / 7.6).
- Custom 404 / error page redesign (Nuxt default is fine for MVP).
- Any authentication backend / endpoint changes.
