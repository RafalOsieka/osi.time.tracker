## Context

The project currently has a basic Vue.js setup. We need to establish the UI foundation using PrimeVue 4 and Tailwind CSS 4. Tailwind 4 is a significant update that simplifies the build pipeline by moving configuration into CSS and removing the hard dependency on PostCSS for many use cases.

## Goals / Non-Goals

**Goals:**
- Implement PrimeVue 4 in Styled mode.
- Use the Aura preset for consistent styling.
- Integrate Tailwind CSS 4 for utility-first styling.
- Enable PrimeIcons for scalable vector icons.
- Ensure zero-configuration for PostCSS/Autoprefixer as per Tailwind 4 capabilities.

**Non-Goals:**
- Implementing specific application pages (only basic smoke test components).
- Setting up complex theme customization (focus on base Aura preset).
- Migrating existing styles (starting fresh).

## Decisions

- **Decision 1: Tailwind CSS 4 Integration via Vite Plugin**
  - **Rationale**: Tailwind 4 provides a dedicated Vite plugin (`@tailwindcss/vite`) that handles the compilation without requiring a separate `tailwind.config.js` or PostCSS setup.
  - **Alternatives**: Using PostCSS (legacy approach, more verbose), Tailwind CLI (less integrated with Vite dev server).

- **Decision 2: CSS-only Tailwind Configuration**
  - **Rationale**: Tailwind 4 allows configuring theme variables and plugins directly in the CSS file using `@theme` and `@plugin` directives. This keeps styling concerns within CSS.
  - **Alternatives**: Traditional `tailwind.config.js` (supported for backward compatibility but discouraged in T4).

- **Decision 3: PrimeVue Styled Mode with Aura**
  - **Rationale**: Styled mode provides pre-built CSS that is easy to use and customize via the Aura preset. This balances ease of use with professional design.
  - **Alternatives**: Unstyled mode (requires writing all CSS for every component), other presets (Lara, Nora).

- **Decision 4: PrimeIcons via CSS Import**
  - **Rationale**: Simple and standard way to include the icon library.
  - **Alternatives**: SVG-only approach (more performant but higher development overhead for a general-purpose UI library).

## Risks / Trade-offs

- **[Risk]** Tailwind 4 and PrimeVue 4 compatibility issues.
  - **Mitigation** Use the latest stable versions and follow official integration guides for PrimeVue 4 + Tailwind 4.
- **[Risk]** Breaking changes in Tailwind 4 (e.g., removal of some legacy syntax).
  - **Mitigation** Verify utility classes against T4 documentation.
- **[Trade-off]** Styled mode adds some CSS weight compared to Unstyled.
  - **Rationale** The speed of development and consistency provided by the Aura preset outweighs the minimal CSS overhead for this project phase.
