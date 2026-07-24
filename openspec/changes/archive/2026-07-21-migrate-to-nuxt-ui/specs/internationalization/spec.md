## MODIFIED Requirements

### Requirement: REQ-075 Document language and Nuxt UI locale synchronization
The application SHALL set the document root `lang` attribute to the active locale, and SHALL keep Nuxt UI's component locale in sync with the active application locale so component-provided labels reflect the same language. Nuxt UI ships `en` and `pl` locale messages; the active locale SHALL be bound from `@nuxtjs/i18n` (e.g. via `UApp`'s `locale` prop / `app.config.ts`) so no separate PrimeVue locale-sync plugin is required.

#### Scenario: html lang reflects active locale
- **WHEN** the active locale is `pl`
- **THEN** the rendered document SHALL expose `<html lang="pl">`, and `<html lang="en">` when the active locale is `en`

#### Scenario: Nuxt UI locale tracks the app locale
- **WHEN** the active application locale changes
- **THEN** Nuxt UI's locale configuration SHALL be updated to the same locale so its built-in component labels render in that language
