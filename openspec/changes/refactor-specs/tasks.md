# Tasks — refactor-specs

Golden rule for every task: **never change an existing REQ-`<nnn>` number.** When
a requirement moves, it keeps its number. Only new requirements get new numbers
(`REQ-169`+). Run `openspec validate --all` after each phase.

## Phase 0 — Baseline (safety net)

- [ ] 0.1 Capture the current set of code-referenced REQ codes (see the grep in
  `design.md`) and save it as the baseline to compare against after archive.

## Phase 1 — Presentation polish (zero risk, no requirement changes)

- [ ] 1.1 Write real Purposes to replace the `TBD - created by archiving …`
  placeholders in: `remote-issue-linking`, `remote-issue-proxy`,
  `remote-system-config`, `remote-sync-review`, `redmine-adapter`,
  `platform-toolchain`, `ci-pipeline`.
- [ ] 1.2 Add the missing `# <name> Specification` H1 to `docker-deployment`,
  `openproject-dev-environment`, `redmine-dev-environment`.
- [ ] 1.3 Normalize heading and blank-line-after-heading style across all specs.

## Phase 2 — Extract the shared boundary contract

- [ ] 2.1 Add the `api-endpoint-conventions` capability with REQ-169–REQ-173
  (see `specs/api-endpoint-conventions/spec.md`).
- [ ] 2.2 Remove `client-management` REQ-032, `project-management` REQ-090,
  `task-management` REQ-139, `time-tracking` REQ-147.
- [ ] 2.3 Trim each of the four Purposes to reference the shared conventions
  instead of restating auth/CSRF.
- [ ] 2.4 Add a reference from `user-settings` REQ-166 Purpose to the shared
  conventions (REQ-166 keeps its domain content; not removed).
- [ ] 2.5 Cross-link `api-endpoint-conventions` REQ-170 to `authentication`
  REQ-011 (mechanism vs. per-route contract).

## Phase 3 — Dissolve `coding-standards-compliance`

- [ ] 3.1 Move REQ-035 → `shared-ui-components` (same number, verbatim).
- [ ] 3.2 Move REQ-036 → `type-safety` (same number, verbatim; note overlap with
  REQ-159).
- [ ] 3.3 Move REQ-037 → `e2e-test-harness` (same number, verbatim).
- [ ] 3.4 Delete the now-empty `coding-standards-compliance` capability.

## Phase 4 — Merge dev-environment specs

- [ ] 4.1 Create `tracker-dev-environments` capability holding REQ-078–082 and
  REQ-098–102 verbatim (numbers preserved), with per-provider scenarios.
- [ ] 4.2 Delete `openproject-dev-environment` and `redmine-dev-environment`.

## Phase 5 — Further structural moves

- [ ] 5.1 Add REQ-108–110 to `remote-system-config` (verbatim, same numbers)
  and remove them from `remote-issue-proxy`; delete the now-empty
  `remote-issue-proxy` capability. Update the `remote-system-config` Purpose to
  cover the server-execution transport.
- [ ] 5.2 Create the `coverage-reporting` capability holding REQ-024–026
  (verbatim, same numbers) and remove them from `ci-pipeline`; `ci-pipeline`
  retains REQ-014–023.

## Phase 6 — Verify

- [ ] 6.1 `openspec validate --all` is green.
- [ ] 6.2 Re-run the code REQ-code inventory from Phase 0; confirm the set is
  **identical** (no code edit required). If it differs, a number was changed by
  mistake — fix the spec, do not edit code.
- [ ] 6.3 Confirm no REQ number collisions across the living specs.
