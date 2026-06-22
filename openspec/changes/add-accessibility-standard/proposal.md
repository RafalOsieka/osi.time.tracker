## Why

`docs/vision.md` and `docs/wbs.md` (8.5) already commit the product to **WCAG 2.1 AA** — keyboard navigation, screen-reader support, sufficient contrast — but nothing enforces it. PrimeVue (Aura) ships accessible primitives, yet labeling, error announcement, focus order and contrast remain the app's responsibility, and the code already drifts: `app/pages/login.vue` uses placeholders instead of labels and shows the login error in a plain `<small>` that assistive tech never announces. Making accessibility a first-class, enforced rule "from the start" is far cheaper than retrofitting it later.

## What Changes

- Establish a project accessibility standard (WCAG 2.1 AA) as a new capability: accessible names for every interactive control (placeholders are never the only label), announced/associated form errors, full keyboard operability with visible focus, and AA contrast with non-color-dependent state.
- Add a static lint gate: `eslint-plugin-vuejs-accessibility` (flat-config recommended set) wired into the `withNuxt().append(...)` chain **before** `eslint-config-prettier`, so `pnpm lint` fails on template a11y violations.
- Document the rules for humans and agents (AGENTS.md accessibility section) so devs and agents follow the same checklist.

## Capabilities

### New Capabilities
- `accessibility`: WCAG 2.1 AA project standard — control naming, form-error announcement, keyboard/focus, contrast, and the enforcing ESLint a11y lint gate.

### Modified Capabilities
<!-- None at the spec level; existing frontend-pages REQ-NFR-015 routing announcements remain valid and complementary. -->

## Impact

- **Code**: `eslint.config.mjs` (add a11y plugin), `package.json` (devDependency), `AGENTS.md` (accessibility rules section). Existing components (e.g. `app/pages/login.vue`) brought into compliance as the lint gate surfaces them.
- **Tests/CI**: `pnpm lint` becomes the enforcement point; no new test project required for this change.
- **Backend/APIs**: none.

## Non-goals

- Runtime/axe automated accessibility tests (deferred to a follow-up change).
- Internationalization / `lang`-attribute work (WBS 7.6, separate change).
- Full manual screen-reader audit of every page (no domain pages exist yet).
- Theme/contrast toggles or high-contrast mode.
- Redesigning PrimeVue component internals or the Aura preset.
