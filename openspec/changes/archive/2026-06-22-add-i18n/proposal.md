## Why

`docs/vision.md` commits the product to being "i18n-ready from day one; English as default; additional locales addable without refactor," and `docs/wbs.md` lists this as NFR **8.4**. Today every UI string is hardcoded English (`app/pages/login.vue`, `app/layouts/default.vue`) and there is no locale infrastructure, no `<html lang>`, and no policy preventing new raw strings. Converting the tiny current surface now is cheap; retrofitting later is not.

## What Changes

- Introduce internationalization infrastructure via `@nuxtjs/i18n` (vue-i18n) **without** locale-prefixed routing, suited to a private, authenticated single-user app.
- Ship **two locales from day one**: `en` (default) and `pl`, as lazy-loaded JSON message files, proving the abstraction rather than leaving a single-locale skeleton.
- Resolve the active locale via the precedence chain **cookie → `Accept-Language` → default `en`**; persist the choice in a cookie only. No `locale` column on the user yet — that arrives with User Settings (WBS **7.4**).
- Externalize all existing hardcoded UI strings (login page, default layout) into message catalogs.
- Set `<html lang>` to the active locale (closing the accessibility change's deferred `lang`-attribute gap, WBS 7.6) and keep **PrimeVue's own locale** (Aura component labels/calendar) in sync with the app locale.
- **Server messages = translation keys (+ optional structured params), translated on the client.** API responses (e.g. `server/api/auth/*`) return a stable `messageKey` and optional `params`; the server stays locale-agnostic. RFC 9457 `problem+json` and server-side rendering remain deferred.
- Add an **i18n lint gate** (`@intlify/eslint-plugin-vue-i18n`) into the `withNuxt().append(...)` chain **before** `eslint-config-prettier`, failing `pnpm lint` on raw literal strings in templates — enforcing NFR 8.4 the way the accessibility gate does.

## Capabilities

### New Capabilities
- `internationalization`: app-wide i18n standard — locale resolution (cookie → Accept-Language → `en`), `en`+`pl` message catalogs, `<html lang>` + PrimeVue locale sync, the key-based server-message contract, and the enforcing ESLint i18n lint gate.

### Modified Capabilities
<!-- None at the spec level; existing authentication and frontend-pages requirements remain valid. The server-message key contract is additive. -->

## Impact

- **Code**: `package.json` (`@nuxtjs/i18n`, `@intlify/eslint-plugin-vue-i18n` devDeps), `nuxt.config.ts` (i18n module + PrimeVue locale wiring), `eslint.config.mjs` (lint gate), new `i18n/locales/{en,pl}.json`, refactor of `app/pages/login.vue` and `app/layouts/default.vue`, `server/api/auth/*` returning `messageKey`/`params`, `AGENTS.md` i18n section.
- **Tests/CI**: `pnpm lint` becomes the enforcement point; add unit coverage for locale resolution and the server-message contract.
- **Backend/APIs**: auth endpoints return stable keys instead of literal English text (additive contract change).

## Non-goals

- User-facing locale picker and persisted `locale` user column (WBS 7.4).
- Server-side message rendering / a second i18n runtime on the server.
- RFC 9457 `problem+json` envelope and content negotiation.
- Locale-prefixed routing (`/en`, `/pl`) and SEO multi-URL concerns.
- Locales beyond `en` and `pl`.
