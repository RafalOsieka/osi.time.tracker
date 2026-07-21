## Context

The remote-integration capability is spread across several specs. `redmine-adapter` (REQ-093..097) is a self-contained provider spec that explicitly says it "implements the neutral remote-tracker adapter". However:

- There is no spec that actually **defines** that neutral contract; it is only referenced.
- There is no `openproject-adapter` spec, even though OpenProject is the MVP baseline provider.
- OpenProject-specific behavior instead leaks into the *generic* specs: `remote-issue-linking` REQ-103 is titled "Search **OpenProject** issues" and talks about "work packages"; `remote-system-config` REQ-108 and `remote-sync-review` scenarios name OpenProject; and `redmine-adapter` REQ-094 references an "OpenProject-style Basic auth header".

This change is a **spec-refactor for consistency**: it re-homes behavior so the two providers sit at the same level of abstraction, mirroring the already-symmetric `tracker-dev-environments` spec. No runtime behavior changes; existing implementation code that already realizes this behavior remains valid.

## Goals / Non-Goals

**Goals:**
- Define the neutral remote-tracker adapter contract once, in its own capability (`remote-adapter-contract`).
- Give OpenProject a first-class provider spec (`openproject-adapter`) that mirrors `redmine-adapter`.
- Make the generic remote-* specs provider-neutral so they reference the contract, not a specific provider.
- Preserve all current behavior — this is a re-homing/rewording exercise, not a behavior change.

**Non-Goals:**
- Adding providers, transports, or execution modes.
- Changing wire DTOs, endpoints, database schema, or any runtime behavior.
- Merging/splitting frontend specs or reworking the spec-naming taxonomy / renumbering existing REQ IDs.

## Decisions

### Decision 1: A standalone contract spec vs. neutralizing in place
**Chosen:** Extract a dedicated `remote-adapter-contract` capability.
**Alternative considered (Option B from exploration):** Keep only per-provider adapter specs and just scrub OpenProject wording from the generic specs. Rejected because the phrase "neutral remote-tracker adapter" is referenced by both provider specs yet defined nowhere — without a home spec the contract stays implicit and drifts again with the next provider. A single owning spec gives every provider a concrete thing to "implement".

### Decision 2: What the contract owns vs. what stays generic
The contract owns the **provider-neutral invariants** that both adapters share:
- The operation set (title search, exact issue-ID lookup, activity options, current-account resolution, same-day time-log fetch, time-entry creation) expressed in adapter-neutral DTOs.
- The `client`/`server` execution-mode equivalence invariant (same results/quirks/error classification; only transport differs).
- Credential hygiene (secret never persisted/logged/returned; client-mode secret only to the tracker origin).
- Transport neutrality (transports attach only provided headers; adapters construct their own auth header in exactly one place).
- 404 → not-found (empty result, not an error).
- Per-`systemType` issue-URL derivation via abstraction, not conditional branching.
- The shared `{ messageKey, params }` error contract with rejected-credential / connection-failure / not-found classes.

What stays in the generic specs is the **local application behavior** that merely *uses* the contract: reference persistence (REQ-104), local unlink (REQ-105), auth/validation/scoping (REQ-106), the Timer/Remote-Sync picker UI (REQ-107), configuration CRUD (REQ-122..126), and the server-proxy endpoints (REQ-108..110) — but reworded to delegate to "the configured tracker's adapter" rather than naming OpenProject.

### Decision 3: `openproject-adapter` mirrors `redmine-adapter` shape
The new `openproject-adapter` captures only OpenProject specifics as an implementation of the contract: work-package title/ID search, Basic-auth header construction, work-package URL pattern, activity options source, duration/log handling, and 404→not-found. It intentionally parallels REQ-093..097 so the two providers read as siblings.

### Decision 4: Delta strategy for existing specs
- `remote-adapter-contract`, `openproject-adapter`: **ADDED** requirements with fresh IDs (REQ-200 onward) to avoid collisions with the current max (REQ-173).
- `remote-issue-linking` REQ-103, `remote-system-config` REQ-108, `redmine-adapter` REQ-094, and OpenProject-naming scenarios in `remote-sync-review`: **MODIFIED** requirements (full updated block) that keep the same REQ IDs and behavior but replace provider-specific wording with contract/`systemType` terms.
- No **REMOVED** requirements — nothing is deprecated.

## Risks / Trade-offs

- **[Overlap between contract and provider specs]** → Keep the contract about *invariants and DTOs* and the provider specs about *provider mechanics*; provider specs state "implements the contract" rather than re-deriving shared rules.
- **[MODIFIED deltas can silently lose scenario detail at archive time]** → Copy each modified requirement's entire block (requirement text + all scenarios) into the delta and only reword provider-specific phrases.
- **[Larger rewrite than Option B]** → Accepted deliberately; this is the whole point of Option A (structural symmetry), and it is confined to spec docs with no code impact.
- **[New REQ IDs must stay globally unique]** → Allocate from REQ-200 upward, above the current max REQ-173.

## Migration Plan

1. Add the two new spec capabilities and the four delta specs under the change.
2. `openspec validate` the change; iterate until clean.
3. On apply/archive, the deltas merge into `openspec/specs/*`, adding the two new specs and neutralizing the existing ones.
4. Rollback is trivial: discard the change directory (no code or data is touched).

## Open Questions

- Should `redmine-adapter` and `openproject-adapter` each restate "implements REQ-2xx of `remote-adapter-contract`" explicitly, or is a prose reference enough? (Leaning: explicit reference for traceability.)
- Requirement-ID renumbering of the existing remote-* specs is out of scope here but remains a known follow-up (`remote-system-config` mixes REQ-122..126 with REQ-108..110).
