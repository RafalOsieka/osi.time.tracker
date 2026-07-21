## Why

The remote-integration specs model their two providers at different levels of abstraction: Redmine has a clean, self-contained `redmine-adapter` spec that claims to implement a "neutral remote-tracker adapter", yet no equivalent `openproject-adapter` spec exists and no spec defines the neutral contract itself. Instead, OpenProject's provider-specific behavior (work-package search wording, Basic-auth header, work-package ID/URL shape) leaks into the supposedly generic `remote-issue-linking`, `remote-sync-review`, and `remote-system-config` specs — so those specs are not actually provider-neutral, and each new provider grows the asymmetry.

## What Changes

- Introduce a standalone `remote-adapter-contract` capability that defines the neutral remote-tracker adapter interface both providers implement: the operation set (title search, exact issue-ID lookup, activity options, current-account resolution, same-day time-log fetch, time-entry creation), adapter-neutral DTOs, the `client`/`server` execution-mode invariant, credential-hygiene rules, per-provider URL derivation, and the shared `{ messageKey, params }` error/not-found contract.
- Add an `openproject-adapter` capability mirroring `redmine-adapter`, capturing OpenProject-specific behavior (work-package search, Basic-auth header, work-package URL pattern, 404→not-found) as a concrete implementation of the neutral contract.
- Neutralize the generic remote-* specs so they reference the contract instead of OpenProject: `remote-issue-linking` REQ-103 becomes provider-neutral (drop "Search OpenProject issues"/"work packages" wording), and OpenProject-specific phrasing in `remote-sync-review` and `remote-system-config` is replaced with contract/`systemType` terms.
- Scrub the `OpenProject-style Basic auth header` reference in `redmine-adapter` REQ-094 so it points at the contract's transport-neutrality rule rather than a sibling provider.

## Capabilities

### New Capabilities
- `remote-adapter-contract`: the provider-neutral remote-tracker adapter interface, DTOs, execution-mode/credential invariants, URL-derivation abstraction, and shared error contract that every provider adapter implements.
- `openproject-adapter`: the OpenProject implementation of the neutral contract (work-package search/lookup, Basic-auth header, URL pattern, failure mapping).

### Modified Capabilities
- `remote-issue-linking`: REQ-103 (and its scenarios) restated as provider-neutral search against the configured tracker via the contract, without OpenProject-specific wording.
- `remote-system-config`: REQ-108 and related scenarios reworded to delegate to the contract/adapter rather than naming OpenProject.
- `remote-sync-review`: scenarios that name OpenProject reworded to reference the resolved `systemType`/contract.
- `redmine-adapter`: REQ-094 scenario reworded to reference the contract's transport-neutrality rule instead of "OpenProject-style Basic auth header".

## Impact

- Specs only: adds `openspec/specs/remote-adapter-contract` and `openspec/specs/openproject-adapter`; edits four existing remote-* specs. No requirement removals — behavior is preserved, only ownership/wording moves.
- Establishes provider parity as the template for future trackers, mirroring the already-symmetric `tracker-dev-environments`.
- No application code or API behavior changes are mandated by this proposal; implementation code already realizing this behavior stays valid.

## Non-goals

- No new tracker providers, transports, or execution modes.
- No changes to runtime behavior, DTO shapes on the wire, endpoints, or the database.
- Not merging/splitting any frontend specs, and not addressing the broader spec-naming taxonomy or requirement-ID renumbering.
