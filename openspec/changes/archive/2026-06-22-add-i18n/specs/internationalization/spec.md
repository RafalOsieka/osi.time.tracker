## ADDED Requirements

### Requirement: REQ-NFR-016 Internationalization infrastructure via @nuxtjs/i18n
The application SHALL provide internationalization through `@nuxtjs/i18n` (vue-i18n) configured with the no-prefix routing strategy, so locale changes never alter URLs. The system SHALL support the locales `en` (default) and `pl`, each backed by a lazy-loaded JSON message catalog under `i18n/locales/`. The default and fallback locale SHALL be `en`, and any missing key in a non-default locale SHALL fall back to the `en` value.


#### Scenario: Default locale is English
- **WHEN** the application loads with no locale cookie and no usable `Accept-Language` header
- **THEN** the active locale SHALL be `en` and English messages SHALL be rendered

#### Scenario: Polish locale renders Polish strings
- **WHEN** the active locale is `pl`
- **THEN** UI strings SHALL be rendered from the `pl` catalog

#### Scenario: Missing translation falls back to English
- **WHEN** the active locale is `pl` and a requested key is absent from the `pl` catalog
- **THEN** the system SHALL render the `en` value for that key rather than the raw key

#### Scenario: Locale change does not alter the URL
- **WHEN** the active locale changes between `en` and `pl`
- **THEN** the current route path SHALL remain unchanged (no locale prefix)

### Requirement: REQ-NFR-017 Locale resolution and cookie persistence
The application SHALL resolve the active locale using the precedence chain **locale cookie → `Accept-Language` request header → default `en`**. The chosen locale SHALL be persisted in a non-sealed cookie that is `SameSite=Lax`, `Secure` in production, and readable by the client (not `HttpOnly`). The system SHALL NOT persist locale on the user record in this change.


#### Scenario: Cookie takes precedence over header
- **WHEN** a request carries a locale cookie set to `pl` and an `Accept-Language` header preferring `en`
- **THEN** the active locale SHALL be `pl`

#### Scenario: Accept-Language used when no cookie
- **WHEN** a request has no locale cookie and an `Accept-Language` header preferring a supported locale
- **THEN** that supported locale SHALL be selected

#### Scenario: Unsupported preferences fall back to default
- **WHEN** neither the cookie nor `Accept-Language` resolves to a supported locale
- **THEN** the active locale SHALL be `en`

#### Scenario: Selected locale is persisted to the cookie
- **WHEN** the active locale is determined or changed
- **THEN** the locale cookie SHALL be written with `SameSite=Lax` and `Secure` in production so the choice survives subsequent requests

### Requirement: REQ-NFR-018 Document language and PrimeVue locale synchronization
The application SHALL set the document root `lang` attribute to the active locale, and SHALL keep PrimeVue's component locale in sync with the active application locale so component-provided labels reflect the same language.


#### Scenario: html lang reflects active locale
- **WHEN** the active locale is `pl`
- **THEN** the rendered document SHALL expose `<html lang="pl">`, and `<html lang="en">` when the active locale is `en`

#### Scenario: PrimeVue locale tracks the app locale
- **WHEN** the active application locale changes
- **THEN** PrimeVue's locale configuration SHALL be updated to the same locale

### Requirement: REQ-NFR-019 Key-based server message contract
Server API responses that convey user-facing messages (including errors from `server/api/auth/*`) SHALL carry a stable translation key in a `messageKey` field and MAY include a `params` object of interpolation values. The server SHALL NOT return rendered, locale-specific user-facing text for these messages, and the client SHALL translate the `messageKey` (with any `params`) using the active locale. Server-referenced keys SHALL reside under the reserved `errors.*` namespace.


#### Scenario: Auth failure returns a key, not English text
- **WHEN** a login attempt fails
- **THEN** the response SHALL include a `messageKey` under the `errors.*` namespace and SHALL NOT include rendered English message text

#### Scenario: Client renders the localized message
- **WHEN** the client receives a response containing a `messageKey` and optional `params`
- **THEN** the client SHALL display the translation of that key in the active locale, interpolating `params` when present

#### Scenario: Same key renders per active locale
- **WHEN** the same `messageKey` is received under `en` versus `pl`
- **THEN** the client SHALL render the English text for `en` and the Polish text for `pl`

### Requirement: REQ-NFR-020 No hardcoded UI strings enforced by lint gate
All user-facing UI strings SHALL be sourced from i18n message catalogs rather than hardcoded in templates. The build SHALL enforce this via `@intlify/eslint-plugin-vue-i18n`, wired into the `withNuxt().append(...)` chain **before** `eslint-config-prettier`, so that `pnpm lint` fails when raw literal text appears in component templates.


#### Scenario: Existing strings are externalized
- **WHEN** the login page and default layout are rendered
- **THEN** their visible text SHALL come from the i18n catalogs rather than hardcoded literals

#### Scenario: Raw template text fails lint
- **WHEN** a component template contains a raw literal user-facing string
- **THEN** `pnpm lint` SHALL report a violation and exit non-zero

#### Scenario: Clean templates pass lint
- **WHEN** all user-facing strings use translation calls
- **THEN** the i18n lint rule SHALL report no violations
