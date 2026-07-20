# Design — refactor-specs

## Context

Two goals drive this refactor: (1) the owner wants **finer, single-purpose
specs**, and (2) the **repeated boundary contract** restated in every domain API
spec should live in one place. A hard constraint sits on top: **REQ-`<nnn>`
codes are referenced from application code and tests**, so any renumbering would
force synchronized code edits and risk drift.

## Decision 1 — REQ numbers are stable identifiers, never renumbered

Treat `REQ-<nnn>` as a permanent, immutable identity for a requirement — like a
database primary key — independent of which capability file currently hosts it.

```
  Requirement moves capability, KEEPS its number
  ┌───────────────────────────┐        ┌───────────────────────────┐
  │ coding-standards-compliance│        │ type-safety                │
  │   REQ-036  ────────────────┼──────▶ │   REQ-036 (same number)    │
  └───────────────────────────┘        └───────────────────────────┘
        REMOVED here                          ADDED there
```

Mechanically, in OpenSpec delta terms, a move = **REMOVED** from the old spec +
**ADDED** to the new spec, re-using the identical `REQ-<nnn>` in the title. The
number never changes, so:

- Every existing code/test comment that cites a REQ code stays correct.
- Only brand-new requirements consume new numbers, continuing the contiguous
  sequence after the current max (`REQ-168`).

### New numbers allocated by this change

| REQ | Capability | Requirement |
| --- | --- | --- |
| `REQ-169` | `api-endpoint-conventions` | Authentication guard |
| `REQ-170` | `api-endpoint-conventions` | CSRF protection on mutations |
| `REQ-171` | `api-endpoint-conventions` | Error contract & 422 on ZodError |
| `REQ-172` | `api-endpoint-conventions` | Per-user isolation → 404 |
| `REQ-173` | `api-endpoint-conventions` | Boundary validation & ISO timestamps |

## Decision 3 — Phase 5 dissolves two grab-bag boundaries into topic-focused specs

`remote-issue-proxy` is only the *server-execution transport* half of remote
configuration, so its three requirements move into `remote-system-config` (which
owns "how the tracker is reached"), and the empty capability is deleted.
Coverage (`REQ-024`–`REQ-026`) is a separable concern from the verify/merge-gate
pipeline, so it splits out of `ci-pipeline` into a single-purpose
`coverage-reporting` capability. Both moves keep every REQ number, so they stay
code-neutral, and both push toward the owner's finer-specs goal.

## Decision 2 — extract the boundary contract, reference it from domain specs

`authentication` `REQ-011` keeps the CSRF/security-header/login-throttle
**mechanism**. The new `api-endpoint-conventions` capability owns the
**per-route contract** every handler must honor and references `REQ-011` for the
CSRF mechanism rather than redefining it. Domain specs drop their standalone
"Authenticated and CSRF-guarded …" requirement and note in their Purpose that
endpoints follow the shared conventions.

```
   BEFORE (rule copied)              AFTER (rule stated once)
   client  REQ-032 ─┐                api-endpoint-conventions
   project REQ-090 ─┤ each repeats     REQ-169..173
   task    REQ-139 ─┤ the 5-point            ▲
   time    REQ-147 ─┘ contract        referenced by client/project/
                                      task/time (+ user-settings REQ-166)
```

`user-settings` `REQ-166` embeds auth+CSRF inside a requirement that also carries
domain behavior (the settings API shape); it is **not** removed — its Purpose
just gains a reference to the shared conventions.

## Requirement movement map

| REQ | From | To | Delta |
| --- | --- | --- | --- |
| `REQ-032` | `client-management` | — | REMOVED (→ conventions) |
| `REQ-090` | `project-management` | — | REMOVED (→ conventions) |
| `REQ-139` | `task-management` | — | REMOVED (→ conventions) |
| `REQ-147` | `time-tracking` | — | REMOVED (→ conventions) |
| `REQ-035` | `coding-standards-compliance` | `shared-ui-components` | REMOVED + ADDED (same number) |
| `REQ-036` | `coding-standards-compliance` | `type-safety` | REMOVED + ADDED (same number) |
| `REQ-037` | `coding-standards-compliance` | `e2e-test-harness` | REMOVED + ADDED (same number) |
| `REQ-078..082` | `openproject-dev-environment` | `tracker-dev-environments` | Phase 4 move, numbers preserved |
| `REQ-098..102` | `redmine-dev-environment` | `tracker-dev-environments` | Phase 4 move, numbers preserved |
| `REQ-108..110` | `remote-issue-proxy` | `remote-system-config` | Phase 5 REMOVED + ADDED (same numbers) |
| `REQ-024..026` | `ci-pipeline` | `coverage-reporting` | Phase 5 REMOVED + ADDED (same numbers) |

Removing `REQ-032/090/139/147` leaves gaps in those four specs. That is
acceptable and intentional under Decision 1: contiguity is a nice-to-have, but
**stable identity outranks contiguity**. The global set stays collision-free.

## Code-reference safety net

Because numbers are preserved, the expectation is **zero** code edits. Verify
with a before/after inventory of REQ citations in code:

```powershell
# Baseline before archiving the change, and re-run after — the set MUST be identical.
Select-String -Path (Get-ChildItem -Recurse -Include *.ts,*.vue,*.mjs -File `
  -Path app,server,shared,test).FullName -Pattern 'REQ-\d{3}' `
  | ForEach-Object { ($_.Line | Select-String -Pattern 'REQ-\d{3}' -AllMatches).Matches.Value } `
  | Sort-Object -Unique
```

Known code-referenced codes (all preserved by this change): `REQ-103`,
`REQ-108`, `REQ-109`, `REQ-114`, `REQ-115`, `REQ-117`, `REQ-119`, `REQ-120`,
`REQ-122`, plus REQ codes cited in `test/nuxt/shell.spec.ts`,
`test/nuxt/confirm-dialog.spec.ts`, `test/nuxt/login-validation.spec.ts`. None of
these belong to a removed/renumbered requirement, so no code change is triggered.
Phase 5 reuses the existing `REQ-108/109/110` (proxy → `remote-system-config`)
and `REQ-024/025/026` (coverage → `coverage-reporting`) numbers, so it is
code-neutral too. Note `REQ-108/109` are code-referenced and stay valid because
their requirement text is re-added verbatim under the same number in
`remote-system-config`.

## Phasing & risk

| Phase | Structural? | Code risk | Notes |
| --- | --- | --- | --- |
| 1 Polish | No | None | Purpose/H1/whitespace only |
| 2 Extract contract | Yes | None (numbers stable) | New spec + 4 REMOVED |
| 3 Dissolve grab-bag | Yes | None (numbers stable) | 3 rehomes |
| 4 Merge dev-env | Yes | None (numbers stable) | 2 specs → 1 |
| 5 Structural moves | Yes | None (numbers stable) | Proxy fold-in + coverage split |

`openspec validate --all` must stay green after each phase.

## Alternatives considered

- **Renumber for contiguity after moves.** Rejected: it breaks the code/spec
  link the owner explicitly called out and buys only cosmetic tidiness.
- **Two separate change proposals.** Rejected per the owner's request for a
  single `refactor-specs` change; phases give the same staged safety within it.
