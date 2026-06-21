## 1. Routing shell and layouts (frontend)

- [x] 1.1 Reduce `app/app.vue` to `<NuxtRouteAnnouncer />` + `<NuxtLayout><NuxtPage /></NuxtLayout>`, removing the inlined login/logout/auth-status markup.
- [x] 1.2 Create `app/layouts/auth.vue` as a centered-card wrapper around `<slot />` (no nav, no logout), carrying the existing card styling.
- [x] 1.3 Create `app/layouts/default.vue` as the app shell: header with brand, a reserved spot for future nav + running-timer slot, and `<slot />` for page content.

## 2. Login page (frontend)

- [x] 2.1 Create `app/pages/login.vue` with `definePageMeta({ layout: 'auth', public: true })`, moving the login form and `onLogin` logic out of `app.vue` and preserving the `login-form`, `username`, `password`, `login-button`, and `login-error` testids.
- [x] 2.2 On successful login, read and sanitize the `?redirect` query (same-origin path starting with a single `/`) and `navigateTo` it, defaulting to `/`.

## 3. Home page and logout relocation (frontend)

- [x] 3.1 Create `app/pages/index.vue` rendering the authenticated welcome placeholder (greeting + signed-in user from `useAuth().user`), preserving the `auth-status` testid and implicitly using the `default` layout.
- [x] 3.2 Add the logout `Button` (with `logout-button` testid) to `app/layouts/default.vue`, wired to `useAuth().logout` then `navigateTo('/login')`.

## 4. Private-by-default SSR guard (frontend)

- [x] 4.1 Create `app/middleware/auth.global.ts` reading `useUserSession().loggedIn` (no browser-only APIs), redirecting `!loggedIn && !public` to `/login?redirect=<to.fullPath>` and `loggedIn && to.path === '/login'` to the sanitized `?redirect` target or `/`.
- [x] 4.2 Implement a same-origin `?redirect` sanitizer (accept only paths starting with a single `/`, reject `//` and absolute URLs) shared by the guard and `login.vue`, with a unit test under `test/unit/`.

## 5. Tests and verification (frontend)

- [x] 5.1 Add `test/nuxt/auth-guard.spec.ts` covering the redirect matrix: unauthenticated `/` → `/login?redirect=/`, deep-link round-trip, authenticated `/login` → `/`, and open-redirect rejection.
- [x] 5.2 Add a `test/nuxt/` page-render spec asserting layout selection per page (`login.vue` → `auth`, `index.vue` → `default`) and preserved testids (`login-form`, `auth-status`, `logout-button`).
- [x] 5.3 Run `pnpm lint` and `pnpm test:nuxt` (and `pnpm test:unit` for the sanitizer) and confirm all pass.
