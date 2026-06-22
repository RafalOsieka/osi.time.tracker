## Context

OSI Time Tracker is a self-hosted, single-user, authenticated Nuxt 4 + PrimeVue (Aura) app. `docs/vision.md`/`docs/wbs.md` (NFR 8.4) require it to be i18n-ready from day one. Currently all UI strings are hardcoded English, there is no locale infrastructure, no `<html lang>`, and `server/api/auth/*` returns literal English error text. The user-facing locale picker and a persisted user `locale` are explicitly deferred to User Settings (WBS 7.4); this change builds only the infrastructure plus `en`+`pl` and a cookie-based preference. Constraints: `nuxt-security` enforces a CSP (no new inline scripts/styles), and PrimeVue ships its own locale system separate from app strings.

## Goals / Non-Goals

**Goals:**
- Add `@nuxtjs/i18n` (vue-i18n) with no locale-prefixed routing.
- Ship `en` (default) + `pl` as lazy-loaded JSON catalogs.
- Resolve locale via cookie → `Accept-Language` → `en`, persisted in a cookie only.
- Externalize existing hardcoded strings; bind `<html lang>` and PrimeVue locale to the active locale.
- Define a key-based server-message contract (`messageKey` + optional `params`), translated only on the client.
- Enforce "no raw template strings" via an ESLint i18n gate.

**Non-Goals:**
- Locale picker UI, persisted user `locale` column (7.4).
- Server-side message rendering / second i18n runtime, RFC 9457 `problem+json`.
- Locale-prefixed routing, SEO multi-URL, locales beyond en/pl.

## Decisions

- **Library: `@nuxtjs/i18n`, `strategy: 'no_prefix'`.** Gives `$t`, pluralization, and `Intl` number/date formatting, lazy locale loading, and SSR-correct detection. _Alternatives:_ manual `useState`+JSON (reinvents pluralization/formatting, risks violating "addable without refactor"); locale-prefixed routing (SEO benefit irrelevant for a private authed app, adds URL noise). Chosen the middle option.
- **Locale resolution = cookie → `Accept-Language` → `en`.** Use the module's `detectBrowserLanguage` with `useCookie: true`, a stable cookie name (e.g. `i18n_locale`), and `fallbackLocale: 'en'`. No DB/user coupling now; when 7.4 adds a user `locale`, it slots in above the cookie in the precedence chain without refactor. _Alternative:_ header-only (no persistence) — rejected, loses the user's explicit choice across sessions.
- **Cookie attributes.** The locale cookie is non-sensitive: `SameSite=Lax`, `Secure` in production, not `HttpOnly` (client must read it to render). Distinct from the sealed auth session cookie.
- **Server messages = keys, client-translated.** API error payloads carry `{ messageKey: string, params?: Record<string, unknown> }`. The server never renders user-facing text and stays locale-agnostic; the client calls `$t(messageKey, params)`. _Alternatives:_ opaque error codes + client mapping table (extra indirection layer); server-side rendering (needs a second runtime + duplicated catalogs — deferred); RFC 9457 envelope (ceremony unneeded for single-user MVP). Keys chosen for minimal boilerplate; keys live under a reserved `errors.*` namespace so renames are a conscious contract change.
- **PrimeVue locale sync.** PrimeVue's `locale` options (aria labels, calendar month/day names) are kept in sync with the active app locale via a small plugin/watcher updating the PrimeVue config when the i18n locale changes. _Alternative:_ leave PrimeVue at default English — rejected, breaks `pl` UX and a11y labels.
- **`<html lang>`.** Set via `useHead({ htmlAttrs: { lang } })` driven by the active locale, closing the a11y change's deferred `lang` gap (WBS 7.6).
- **Lint gate: `@intlify/eslint-plugin-vue-i18n`.** Appended in `withNuxt().append(...)` **before** `eslint-config-prettier`, enabling `no-raw-text` so `pnpm lint` fails on literal template strings. _Alternative:_ documentation-only convention — rejected, not enforced, mirrors the existing accessibility gate pattern.
- **Catalog location & shape.** `i18n/locales/{en,pl}.json`, nested namespaces (`auth.*`, `layout.*`, `errors.*`). Single shared catalog dir so a future server-side renderer (if ever) can reuse the same files without restructuring.

## Risks / Trade-offs

- **API contract couples to i18n key names** → Confine server-referenced keys to a stable `errors.*` namespace; treat renames as deliberate contract changes covered by tests.
- **Lint gate flags legitimate non-text (icons, data-testid, numeric literals)** → Configure `no-raw-text` `ignorePattern`/`ignoreNodes` and allow-list as needed; tune iteratively like the a11y gate.
- **PrimeVue/app locale drift** → Single watcher as the one sync point; cover with a focused test.
- **CSP friction from the i18n/PrimeVue wiring** → Keep all wiring in modules/plugins (no inline scripts); verify CSP headers still pass after integration.
- **Missing `pl` translations fall back silently** → `fallbackLocale: 'en'` plus optional CI check for key parity between catalogs.
