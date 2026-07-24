## ADDED Requirements

### Requirement: REQ-175 Default font stack (no manual font loading)
The application SHALL NOT load a custom webfont or inject an external font stylesheet. Sans-serif typography SHALL use the Nuxt UI / Tailwind default font stack (no project-level `--font-sans` override and no hand-written `:root { font-family }` rule). `@nuxt/fonts` remains available only via auto-registration by `@nuxt/ui` if a future `@theme` font token is introduced; it MUST NOT be listed again in `modules` or added as a direct dependency solely for defaults.

#### Scenario: No manual font-family override
- **WHEN** any page is rendered
- **THEN** the effective sans-serif family SHALL come from framework defaults, not from a manual `:root { font-family }` rule or a project `--font-sans` override

#### Scenario: No manual external font stylesheet link
- **WHEN** the app document head is produced
- **THEN** it SHALL NOT contain a hand-injected external font stylesheet `<link>` (e.g. rsms.me Inter)

#### Scenario: Auto-registered fonts module only
- **WHEN** Nuxt modules are configured
- **THEN** `@nuxt/fonts` SHALL NOT appear as an explicit `modules` entry; configuration (if any) goes through the root `fonts` key or a future `@theme` token
