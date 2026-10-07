# core-i18n Specification

## Purpose
Define how the application speaks English and Polish: which locales exist, how the active locale is resolved and remembered per browser, how the document and component locales follow it, how server messages travel as translation keys, and how hardcoded UI text is kept out.

## Requirements

### Requirement: REQ-073 Internationalization infrastructure
The application SHALL provide internationalization without locale prefixes in routes, so locale changes never alter URLs. The system SHALL support the locales `en` (default) and `pl`, each backed by its own message catalog. The default and fallback locale SHALL be `en`, and any missing key in a non-default locale SHALL fall back to the `en` value.

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

### Requirement: REQ-074 Locale resolution and cookie persistence
The application SHALL resolve the active locale using the precedence chain **locale cookie → `Accept-Language` request header → default `en`**. The chosen locale SHALL be persisted in a non-sealed cookie that is `SameSite=Lax`, `Secure` in production, and readable by the client (not `HttpOnly`). The system SHALL NOT persist the locale on the user record.

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

### Requirement: REQ-075 Document language and Nuxt UI locale synchronization
The application SHALL set the document root `lang` attribute to the active locale, and SHALL keep the UI component library's locale in sync with the active application locale so component-provided labels reflect the same language.

#### Scenario: html lang reflects active locale
- **WHEN** the active locale is `pl`
- **THEN** the rendered document SHALL expose `<html lang="pl">`, and `<html lang="en">` when the active locale is `en`

#### Scenario: Nuxt UI locale tracks the app locale
- **WHEN** the active application locale changes
- **THEN** Nuxt UI's locale configuration SHALL be updated to the same locale so its built-in component labels render in that language

### Requirement: REQ-076 Key-based server message contract
Server API responses that convey user-facing messages (including authentication errors) SHALL carry a stable translation key from the message catalogs in a `messageKey` field and MAY include a `params` object of interpolation values. The server SHALL NOT return rendered, locale-specific user-facing text for these messages, and the client SHALL translate the `messageKey` (with any `params`) using the active locale.

#### Scenario: Auth failure returns a key, not English text
- **WHEN** a login attempt fails
- **THEN** the response SHALL include a catalog `messageKey` and SHALL NOT include rendered English message text

#### Scenario: Client renders the localized message
- **WHEN** the client receives a response containing a `messageKey` and optional `params`
- **THEN** the client SHALL display the translation of that key in the active locale, interpolating `params` when present

#### Scenario: Same key renders per active locale
- **WHEN** the same `messageKey` is received under `en` versus `pl`
- **THEN** the client SHALL render the English text for `en` and the Polish text for `pl`

### Requirement: REQ-077 No hardcoded UI strings enforced by lint gate
All user-facing UI strings SHALL be sourced from the i18n message catalogs rather than hardcoded in templates. An automated check SHALL reject raw literal text in component templates and SHALL block merging.

#### Scenario: Existing strings are externalized
- **WHEN** the login page and default layout are rendered
- **THEN** their visible text SHALL come from the i18n catalogs rather than hardcoded literals

#### Scenario: Raw template text fails lint
- **WHEN** a component template contains a raw literal user-facing string
- **THEN** the automated check SHALL report a violation and fail

#### Scenario: Clean templates pass lint
- **WHEN** all user-facing strings use translation calls
- **THEN** the automated check SHALL report no violations

### Requirement: REQ-302 Document title strings come from catalogs

The document title's page segment and brand SHALL be sourced from the `en`/`pl` i18n catalogs (existing page/nav keys where they already name the screen). New keys, if required (for example login), SHALL be added in both catalogs in parity. The title template separator and brand MUST NOT be hardcoded English in application source.

#### Scenario: Brand matches chrome

- **WHEN** the document title is rendered
- **THEN** the brand segment SHALL equal `t('layout.title')` for the active locale

#### Scenario: Catalog parity

- **WHEN** a new title-related key is introduced
- **THEN** both `en` and `pl` catalogs SHALL define it

### Requirement: REQ-401 Authenticated locale picker on Profile
The `/profile` page (workspace-settings REQ-494) SHALL offer a language control listing `en` and `pl` and stating that the choice applies to this browser. Changing it SHALL switch the active locale immediately (REQ-075) and write the locale cookie (REQ-074); the locale SHALL NOT be stored on the user record. The control SHALL NOT appear in the account menu or the shell chrome. It SHALL be labelled, keyboard operable, and translated with `en`/`pl` parity.

#### Scenario: Locale control is on Profile
- **WHEN** an authenticated user opens `/profile`
- **THEN** a language control listing English and Polish SHALL be present, with a hint that it applies to this browser

#### Scenario: Locale is not in the account menu
- **WHEN** the sidebar footer account menu is opened
- **THEN** language options SHALL NOT appear there

#### Scenario: Changing language applies without Save
- **WHEN** the user selects Polish on `/profile` while the active locale is English
- **THEN** the UI SHALL render Polish strings without a page reload and without a profile PATCH

#### Scenario: Locale cookie is updated
- **WHEN** the user changes the language on `/profile`
- **THEN** the locale cookie SHALL be written so the choice survives subsequent requests

#### Scenario: Locale is not stored on the account
- **WHEN** the user changes the language on `/profile` and then logs in from another browser with no locale cookie
- **THEN** the other browser SHALL resolve the locale from its own cookie, `Accept-Language`, or the default, not from the first browser's choice

#### Scenario: Control is accessible and internationalized
- **WHEN** the language control is rendered
- **THEN** it SHALL expose an accessible name from the i18n catalogs and remain fully keyboard operable
