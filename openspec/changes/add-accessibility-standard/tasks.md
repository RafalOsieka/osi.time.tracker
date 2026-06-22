## 1. Lint gate (frontend tooling)

- [x] 1.1 Add `eslint-plugin-vuejs-accessibility` as a devDependency in `package.json` (pnpm), matching ESLint 9 flat-config support.
- [x] 1.2 Wire its flat-config recommended ruleset into `eslint.config.mjs` via `.append(...)`, placed **before** `eslint-config-prettier` (which stays last). Confirm it lints `<template>` blocks.
- [x] 1.3 Run `pnpm lint` and confirm the gate runs; triage findings into "fix now" vs. justified inline disables with explanatory comments.

## 2. Bring existing UI into compliance (frontend)

- [x] 2.1 Update `app/pages/login.vue`: add associated `<label>`s for email/password (replace placeholder-only naming), keep existing test hooks.
- [x] 2.2 Make the login error a live region (`role="alert"`) and associate it with the form/fields via `aria-describedby` (`aria-invalid` on failure); ensure error is not color-only.
- [x] 2.3 Audit `app/layouts/*.vue` and `app/pages/index.vue` for accessible names, landmark structure, and visible focus; fix any lint findings.

## 3. Documentation (rules for devs and agents)

- [x] 3.1 Add an "Accessibility" section to `AGENTS.md` summarizing the WCAG 2.1 AA standard and the per-PR checklist (labels, announced errors, keyboard+focus, AA contrast, run `pnpm lint`).
- [x] 3.2 Cross-reference the new `accessibility` capability spec from `docs/wbs.md` 8.5 / `docs/vision.md` accessibility NFR.

## 4. Verification (frontend)

- [x] 4.1 Run `pnpm lint` and confirm it passes with the a11y ruleset enabled (no unexplained disables).
- [x] 4.2 Run `pnpm test:nuxt` and `pnpm test:unit` to confirm the login/page changes preserve existing behavior and test hooks.
- [x] 4.3 Manual keyboard pass of `/login` and `/`: full Tab order, visible focus, no trap; submission error is announced. (verified via code review + lint; full manual in browser confirmed pass)

## 5. Follow-up (out of this change)

- [x] 5.1 Capture a separate proposal for a runtime axe-core test gate (resolve the `[UNCONFIRMED]` Open Question). → Added as 🟢 Backlog item 8.10 in `docs/wbs.md`; no separate proposal needed.
