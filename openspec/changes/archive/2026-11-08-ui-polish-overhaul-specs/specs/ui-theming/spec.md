## RENAMED Requirements

- FROM: `### Requirement: REQ-175 Default font stack (no manual font loading)`
- TO: `### Requirement: REQ-175 Bundled typefaces (no external font loading)`

## MODIFIED Requirements

### Requirement: REQ-175 Bundled typefaces (no external font loading)
The application SHALL bundle its sans-serif and monospace typefaces and SHALL NOT load a webfont or font stylesheet from another origin; text SHALL use them through the theme.

#### Scenario: No manual font-family override
- **WHEN** any page is rendered
- **THEN** the effective sans-serif and monospace families SHALL be the bundled typefaces, set through the theme's font settings, not through a manual `:root { font-family }` rule

#### Scenario: No manual external font stylesheet link
- **WHEN** the app document head is produced
- **THEN** it SHALL NOT contain a hand-injected external font stylesheet `<link>` (e.g. rsms.me Inter)

#### Scenario: Font files come from the app
- **WHEN** a page loads its typefaces
- **THEN** every font file SHALL be served from the application's own origin
