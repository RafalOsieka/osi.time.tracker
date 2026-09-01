## ADDED Requirements

### Requirement: REQ-302 Document title strings come from catalogs

The document title's page segment and brand SHALL be sourced from the `en`/`pl` i18n catalogs (existing page/nav keys where they already name the screen). New keys, if required (for example login), SHALL be added in both catalogs in parity. The title template separator and brand MUST NOT be hardcoded English in application source.

#### Scenario: Brand matches chrome

- **WHEN** the document title is rendered
- **THEN** the brand segment SHALL equal `t('layout.title')` for the active locale

#### Scenario: Catalog parity

- **WHEN** a new title-related key is introduced
- **THEN** both `en` and `pl` catalogs SHALL define it
