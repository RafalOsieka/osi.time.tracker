# Tasks

All code work is frontend (`apps/web/app`, `apps/extension/src`). There are no backend or API changes. Each fix starts with a failing regression test (design D2).

## 1. Web app fixes (frontend)

- [x] 1.1 Remote Sync unlinked row label (REQ-520). Add a failing case to `apps/web/test/nuxt/remote-sync-page.spec.ts`: an unlinked row's state tooltip and accessible name start with "Needs attention" and its visually hidden label is not empty. Then make the state label cover the unlinked state. Verify with `pnpm test:nuxt`.
- [x] 1.2 The day total holds when the timer stops (REQ-527). Add a failing case to `remote-sync-page.spec.ts`: with a running entry of the displayed day, stopping it while the day reload is pending must not lower the day total. Then keep the running part in the total until the reloaded rows arrive. Verify with `pnpm test:nuxt`.
- [x] 1.3 The Project chip's remove control is reachable by touch (REQ-374). Add a failing case to `apps/web/test/nuxt/task-title-input.spec.ts`: on a coarse pointer the remove control is shown at rest. Then implement it while keeping the hover and focus behaviour. Verify with `pnpm test:nuxt`.
- [x] 1.4 E2E for the chip on touch. Extend `apps/web/test/e2e/ui/timer-project-mention.spec.ts` with a touch-enabled context: set a chip in the top-bar timer, tap it, tap remove, and assert the chip is gone. Verify with `pnpm test:e2e:ui`.
- [x] 1.5 Remove the unused `apps/web/app/utils/capitalize-first.ts` and its unit test, since REQ-516 keeps the locale's casing. Verify with `pnpm lint`, `pnpm type-check` and `pnpm test:unit`.

## 2. Extension fixes (frontend)

- [x] 2.1 Restore handoff with one affected approval (REQ-408). The setup page talks to the browser directly and has no unit harness, so the failing case is the browser test of 2.3: opening setup with `restore=<id>`, when that approval is the only one without access, focuses the alert's restore action. Then fix the focus target. Verify with `pnpm test:extension`.
- [x] 2.2 The HTTP approve action's accessible name (REQ-416). Add a failing case to `apps/extension/test/unit/suggestion-list.spec.ts`: the accessible name of the HTTP approve button contains its visible "Approve despite HTTP" text and the address. Then fix the label. Verify with `pnpm test:extension`.
- [x] 2.3 Browser check of the popup-to-setup restore flow. Extend `apps/extension/test/browser/options-ui.spec.ts` to open the options page with a single `restore=<id>` and assert that focus lands on the alert's restore action. Verify with `pnpm test:extension`.

## 3. Traceability

- [x] 3.1 Point code comments and test titles that describe behaviour now specified under REQ-514 to REQ-527 at the new codes (for example the needs-attention kind at REQ-520 and the running day total at REQ-527). Verify by grepping `apps/` for each new code.

## 4. Integration checks

- [x] 4.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:extension` and `pnpm test:e2e:ui`, and verify all pass.
- [x] 4.2 Run `pnpm exec openspec validate ui-polish-overhaul-specs --strict` and verify it passes.

## Workflow follow-up

- Sync or archive the change. While doing so, update the ui-theming Purpose, which still mentions "the default font stack", to the bundled typefaces (REQ-175), and run `pnpm exec openspec validate --specs`.
- Update the design log entry that says the client report keeps its placeholder; the page now shows a live summary (REQ-384).
- Open the PR stacked on `feat/ui-polish-overhaul-v2`, rebased on it first.
