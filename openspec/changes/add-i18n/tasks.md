## 1. Dependencies & Module Setup

- [ ] 1.1 Add `@nuxtjs/i18n` and `@intlify/eslint-plugin-vue-i18n` as devDependencies in `package.json` (pnpm)
- [ ] 1.2 Register `@nuxtjs/i18n` in `nuxt.config.ts` `modules` with `strategy: 'no_prefix'`, `defaultLocale: 'en'`, `fallbackLocale: 'en'`, and locales `en`/`pl`
- [ ] 1.3 Configure `detectBrowserLanguage` (cookie name `i18n_locale`, `useCookie: true`, `Lax`, `Secure` in production, redirect off) for the cookie → `Accept-Language` → `en` chain

## 2. Locale Catalogs (Frontend)

- [ ] 2.1 Create `i18n/locales/en.json` with `auth.*`, `layout.*`, and `errors.*` namespaces
- [ ] 2.2 Create `i18n/locales/pl.json` mirroring the `en.json` key set with Polish translations
- [ ] 2.3 Add a unit test asserting `en.json` and `pl.json` have an identical key set (catalog parity)

## 3. Externalize Existing Strings (Frontend)

- [ ] 3.1 Replace hardcoded strings in `app/pages/login.vue` (labels, placeholders, button, error) with `$t` keys
- [ ] 3.2 Replace hardcoded strings in `app/layouts/default.vue` (title, logout button) with `$t` keys
- [ ] 3.3 Add/extend the login E2E test to assert localized text renders for `en` and `pl`

## 4. Document Language & PrimeVue Sync (Frontend)

- [ ] 4.1 Bind `<html lang>` to the active locale via `useHead({ htmlAttrs: { lang } })`
- [ ] 4.2 Add a plugin/watcher syncing PrimeVue's `locale` config to the active app locale
- [ ] 4.3 Add a unit/Nuxt test verifying `<html lang>` and PrimeVue locale update when the locale changes

## 5. Key-Based Server Message Contract (Backend)

- [ ] 5.1 Define a shared TypeScript type `{ messageKey: string; params?: Record<string, unknown> }` for API messages
- [ ] 5.2 Update `server/api/auth/*` error responses to return `messageKey` (under `errors.*`) instead of English text
- [ ] 5.3 Add the corresponding `errors.*` keys to `en.json` and `pl.json`
- [ ] 5.4 Update the client (login flow) to translate `messageKey`/`params` via `$t` instead of the hardcoded error
- [ ] 5.5 Add integration tests for the auth endpoints: happy path plus failure returning the expected `messageKey` (and no rendered English text)

## 6. Lint Gate

- [ ] 6.1 Append `@intlify/eslint-plugin-vue-i18n` to the `withNuxt().append(...)` chain in `eslint.config.mjs` **before** `eslint-config-prettier`, enabling `no-raw-text`
- [ ] 6.2 Tune `no-raw-text` ignore patterns (icons, numeric/non-text literals) so legitimate cases pass
- [ ] 6.3 Run `pnpm lint` and confirm it passes with externalized strings and fails on a deliberately reintroduced raw string (then revert the probe)

## 7. Documentation

- [ ] 7.1 Add an i18n section to `AGENTS.md` (locale resolution, catalog layout, server `messageKey` contract, lint gate, "no hardcoded strings" policy)
- [ ] 7.2 Update `docs/vision.md`/`docs/wbs.md` references to reflect day-one `en`+`pl` and cookie-only persistence until 7.4
