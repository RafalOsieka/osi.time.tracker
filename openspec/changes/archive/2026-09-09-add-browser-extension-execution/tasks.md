## 1. Protocol and extension build

- [x] 1.1 Use the archived `2026-09-07-migrate-to-pnpm-monorepo` baseline (`@osi/time-tracker` in `apps/web`) to add private extension/protocol manifests and independent build/type-check entries; verify both resolve `@osi/remote-trackers/contracts`, `/openproject`, and `/redmine` as needed without Nuxt preparation.
- [x] 1.2 Define versioned handshake and seven discriminated operation request/result schemas, safe errors, correlation fields, and resource limits; specify serialization and app-side reconstruction of `RemoteAdapterError` preserving allowed `messageKey` and optional `status`, and verify emitted package declarations agree with the neutral adapter contract.
- [x] 1.3 Add protocol unit tests for every operation, malformed/oversized messages, version mismatch, mismatched result discriminants, and safe error serialization; cover provider message-key/status round trips and exclusion of raw exception/upstream data, then run the standalone protocol suite.
- [x] 1.4 Add the Manifest V3 worker/content/options entry builds and bundled CSP-safe assets; verify unpacked output contains all referenced files and no web-source/runtime-code dependency.
- [x] 1.5 Add extension-owned isolated persistent-profile Chromium fixtures and browser suites under `apps/extension`, with explicitly declared Playwright/test dependencies and no-CORS local OpenProject/Redmine HTTP fakes; verify the built extension loads and fixtures are reachable, ready for the worker/UI journeys below, without borrowing web dependencies.

## 2. Extension authorization and worker backend

- [x] 2.1 Implement extension-owned security canonicalization, normalized website/destination approval storage, exact origin/provider/base-path matching, permission reconciliation, and revocation; do not treat the tracker package's trailing-slash-only `normalizeBaseUrl()` as an authorization check; verify extension type-check and the approval unit tests in 2.2.
- [x] 2.2 Add unit tests for allow/deny, differing ports/providers/paths, denied browser permission, shared host grants, startup reconciliation, and revocation during an operation; run the approval suite for 2.1.
- [x] 2.3 Implement the guarded provider transport with URL/path/method/header checks, no redirects or ambient cookies, response-byte limits, deadlines, and cancellation; verify it satisfies the shared transport contract.
- [x] 2.4 Add transport tests for normal responses, mounted base paths, encoded traversal, malicious response-derived URLs, redirects, auth rejection, unreachable hosts, and resource bounds; assert forbidden destinations receive zero requests and secrets never enter errors (2.3).
- [x] 2.5 Implement internal runtime-port sender/document validation and dispatch all seven operations through shared providers, with per-document limits and transient credentials; verify worker type-check and no duplicated provider logic.
- [x] 2.6 Add worker unit tests for both providers' operation dispatch, unapproved/foreign/frame senders, secret hygiene, in-flight limits, port disposal, and worker-restart failure; run tests for 2.5 including no automatic create replay.

## 3. Extension frontend and bridge

- [x] 3.1 Implement the isolated content bridge and credential-free page handshake using document-bound ports and validated messages; verify its standalone build and browser registration.
- [x] 3.2 Add bridge unit tests for exact origin/source checks, iframe rejection, incompatible handshake, request correlation, late replies, timeout, and disconnect cleanup; run tests for 3.1.
- [x] 3.3 Add extension-owned website/tracker approval and revocation UI with English/Polish catalog parity, HTTP warning, and keyboard-accessible status/error feedback; verify component rendering and type-check.
- [x] 3.4 Add real-extension browser journeys for approval, denied permission, revocation, settings reload, and keyboard navigation/localization; verify 3.3 and that website-origin requests cannot auto-approve destinations.

## 4. Web backend and tracker persistence

- [x] 4.1 Extend the web-owned tracker mode schema/order to accept `extension`, preserving default `client`, storage shape, and existing input rules; run schema tests and verify no SQL migration is generated or needed.
- [x] 4.2 Add tracker API integration coverage for extension create/update/read, absent-mode default, unknown-mode rejection, and cross-user rejection; run tests proving 4.1 without any extension installation.
- [x] 4.3 Add or tighten owned-mode checks across OSI remote endpoints so extension configurations never cause upstream execution; verify authentication/ownership still resolve first and existing server delegation remains unchanged.
- [x] 4.4 Extend remote proxy API integration suites with successful server-mode calls and extension-mode rejection for each operation family; assert zero upstream calls on rejection and retain unauthenticated/error coverage for 4.3.

## 5. Web frontend and export safety

- [x] 5.1 Implement client-only extension availability/handshake service and the seven-operation execution adapter, then update the remote factory; verify type-check and no SSR bridge/network execution.
- [x] 5.2 Add adapter/factory/service unit tests for all operations, neutral results/errors, unavailable/incompatible/permission states, secret-free preflight, SSR, and no client/server fallback; run tests for 5.1.
- [x] 5.3 Add extension mode form labels, setup/recheck guidance, and remote-action availability feedback across linking, sync, and reports with English/Polish parity; verify existing local-entry UI remains independent.
- [x] 5.4 Add web E2E journeys for saving the mode without installation, setup/recheck, unavailable remote actions, unchanged persisted mode, and continued local entry creation; verify 5.3 with stable selectors.
- [x] 5.5 Add typed unknown-create handling, non-secret pending-create markers, and explicit duplicate-risk confirmation; preserve known-ID finalization retries and update relevant secret/error comments; verify the export outcome surface distinguishes both uncertainty cases.
- [x] 5.6 Add export unit tests for definite pre-dispatch failure, unknown post-dispatch outcome, retained markers after reload, confirmed retry, and known-ID finalization without repeated creation; run tests for 5.5 with fake timers.
- [x] 5.7 Add a browser export journey whose fake tracker creates a log but loses the reply; verify one remote create, uncertainty feedback, reload safety, explicit retry warning, and no secret in markers (5.5).

## 6. End-to-end integration and delivery

- [x] 6.1 Verify the completed worker reaches the no-CORS fixtures through the real website bridge without page interception or live trackers, using the harness from 1.5.
- [x] 6.2 Exercise both providers end-to-end through the website/content/worker path, including search, lookup, activities, account, same-day/range logs, and export; assert OSI API traffic and extension storage contain no tracker secret.
- [x] 6.3 Add real-browser negative cases for unapproved origins/destinations, revoked grants, malformed messages, redirect/URL escape, and disconnected worker; verify no forbidden network calls, no automatic create retries, and actionable errors.
- [x] 6.4 Wire root build/type-check/test commands in tracker -> protocol -> web/extension dependency order, including web test entry points and initial builds plus package watchers for development; verify dependency failures stop consumers and shared edits reach consumers without manual rebuilds.
- [x] 6.5 Update Docker workspace manifest-copy/install and web dependency build stages for the protocol, keeping extension packaging/output outside the production web image; verify a clean image build using isolated resources only.
- [x] 6.6 Add extension-scoped Vue/localization lint configuration and generated-output exclusions without requiring Nuxt-generated configuration for independent extension checks; verify extension lint/catalog parity and retain root lint/format gates without modifying vendored anti-slop rules.
- [x] 6.7 Extend CI artifacts/gates and the existing independent-package check to cover protocol build/type-check/tests without Nuxt preparation, plus independent extension checks; retain protocol/extension test ownership and web integration tests under `apps/web/test`, and verify clean ordered builds, lint, formatting, type-check, protocol/extension/web unit suites, Nuxt tests, and affected API/UI E2E suites.
- [x] 6.8 Document local build/load/reload/approve steps, version mismatch recovery, workplace-policy limitations, secret ownership, and safe downgrade; verify instructions against unpacked Chrome and Edge using only isolated fake trackers.