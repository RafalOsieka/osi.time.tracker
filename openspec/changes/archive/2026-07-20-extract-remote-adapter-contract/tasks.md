## 1. New capability specs

- [x] 1.1 Author `specs/remote-adapter-contract/spec.md` (REQ-200..206): operation set, execution-mode equivalence, transport neutrality, credential hygiene, 404→not-found, URL derivation, shared error contract
- [x] 1.2 Author `specs/openproject-adapter/spec.md` (REQ-210..214) mirroring `redmine-adapter`: work-package search/lookup, Basic-auth header, project-scoped activities, shared rounding, bounded pagination
- [x] 1.3 Cross-check the new contract requirements against `redmine-adapter` REQ-093..097 to confirm both providers are described at the same level of abstraction

## 2. Neutralize existing remote specs (deltas)

- [x] 2.1 Delta `specs/redmine-adapter/spec.md`: MODIFIED REQ-094 to reference the contract's transport-neutrality/credential-hygiene rules instead of an "OpenProject-style Basic auth header"
- [x] 2.2 Delta `specs/remote-issue-linking/spec.md`: MODIFIED REQ-103 reworded provider-neutral (drop "OpenProject"/"work packages"), delegating to the contract
- [x] 2.3 Delta `specs/remote-system-config/spec.md`: MODIFIED REQ-108 reworded to forward known contract operations without naming OpenProject
- [x] 2.4 Delta `specs/remote-sync-review/spec.md`: MODIFIED REQ-112, REQ-114, REQ-118, REQ-119, REQ-120, REQ-121 to remove OpenProject-specific wording in favor of contract/`systemType` terms

## 3. Validation of the change artifacts

- [x] 3.1 Run `openspec validate extract-remote-adapter-contract --strict` and resolve any errors
- [x] 3.2 Grep the change's `specs/` deltas to confirm no remaining unintended "OpenProject"/"work package" wording outside `openproject-adapter`
- [x] 3.3 Confirm all new requirement IDs (REQ-200..206, REQ-210..214) are globally unique across `openspec/specs`

## 4. Optional code alignment (backend, no behavior change)

- [x] 4.1 Verify the codebase already exposes a neutral adapter contract type in `shared/types`/`server`; if the OpenProject and Redmine adapters do not both implement a single named interface, introduce it without changing behavior
- [x] 4.2 Verify per-provider issue-URL derivation and auth-header construction are each resolved through the per-provider abstraction (no `systemType` conditional branching in shared code); refactor only if a conditional leak exists
- [x] 4.3 Backend test: assert (or add) unit tests proving both adapters satisfy the neutral contract's operation set and that 404 lookups resolve to not-found for each provider
- [x] 4.4 Backend test: assert transport code attaches only supplied headers (no provider auth construction) for both providers

## 5. Verification

- [x] 5.1 Run `pnpm test:unit` and `pnpm test:nuxt` to confirm existing remote-integration tests remain green (no behavior change)
- [x] 5.2 Run `pnpm lint` and `pnpm type-check` if any code files were touched in section 4 — N/A: section 4 was verification-only, no code files were modified
- [x] 5.3 On approval, apply/archive the change so the deltas merge into `openspec/specs`
