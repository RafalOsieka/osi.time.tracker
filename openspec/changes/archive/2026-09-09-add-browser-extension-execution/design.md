## Context

See `proposal.md` for motivation and dependency. The current web factory selects client/server adapters; sync caches are execution-neutral. Tracker mode is a validated enum backed by a text column. Secrets live in browser localStorage. Provider behavior covers seven operations, including date-range reports. `use-sync-export.ts` currently collapses create failures to `remote_failure`, while `uncertain_finalization` specifically means a known remote log ID with failed local finalization. These cases must not be conflated.

The prerequisite is implemented and archived as `2026-09-07-migrate-to-pnpm-monorepo`. The web package is `@osi/time-tracker` in `apps/web`; `@osi/remote-trackers` exposes emitted `/contracts`, `/openproject`, and `/redmine` exports. The workspace already includes `apps/*` and `packages/*`; use these established boundaries rather than repeating the migration.

## Goals / Non-Goals

Enforce the new spec's authorization and lifecycle boundaries without adding a second provider implementation. Keep extension-only browser APIs out of both packages and Nuxt code. See proposal for product exclusions; this design does not promise exactly-once creation across a lost response or browser restart.

## Decisions

### Packaging and build

Add `@osi/extension` in `apps/extension`, built with Vite as a Chromium Manifest V3 extension (worker, isolated-world content script, Vue options/popup surface). Bundle every executable dependency; no remote code, Nuxt types, or web-source imports. Use standalone extension TypeScript with Chrome types and explicit build entries, including a non-module content-script bundle suitable for injection. Reuse Vue and Tailwind tooling for extension-owned accessible controls, without importing Nuxt UI runtime. Keep extension English/Polish catalogs together with matching keys; use browser locale with an explicit preference override.

Add private `@osi/extension-protocol` in `packages/extension-protocol`, built to ESM plus declarations with explicit exports and standalone tests. It depends only on the tracker contracts and `zod`. Runtime input/result schemas belong here where absent; neutral inferred types must agree with the tracker contract through compile-time checks rather than copied unrelated interfaces.

Root builds and type-checks must order dependencies as tracker package -> protocol -> web/extension and fail before consumers when a dependency fails. Web test entry points must build the protocol as well as the tracker package. Development commands perform initial dependency builds and watch both packages alongside the selected application with shared lifecycle cleanup. Update Docker's workspace manifest-copy/install stage and web dependency build order; do not build or ship the extension output in the production web image.

Extend the existing independent-package CI gate to cover the protocol without Nuxt preparation; independent extension build/type-check/lint/tests must likewise avoid generated Nuxt context. Scope extension Vue/localization lint configuration to its own source and catalogs rather than the root ESLint configuration's generated Nuxt import and web catalog paths. Exclude generated extension/package output from source checks while retaining existing web and repository rules.

```text
web ------> extension-protocol ------> remote-trackers/contracts
 |                                          ^
 +--------> remote-trackers                  |
                                            |
extension -> extension-protocol              |
 +---------> remote-trackers ----------------+
```

Alternative: transport-only relay with arbitrary HTTP messages. Smaller initially, but harder to authorize and exposes a generic network primitive. Named operations reuse provider logic while keeping the bridge narrow.

### Protocol and document channel

Use a dynamically registered isolated content script only on approved OSI sites. The page connects through a same-window, exact-origin `postMessage` handshake that transfers a `MessagePort`; the content script connects to the worker through an internal runtime port. Validate page source/origin, reject frames, and bind each runtime port to Chrome-provided extension ID, tab, frame, origin/URL, and document identity. Target-origin checks and request IDs prevent cross-document mistakes, not attacks by code already executing on the approved origin.

The credential-free handshake returns protocol version and supported operation names, and may check a non-secret destination approval. Version 1 requires an exact protocol match; package/app versions are diagnostic only. Send no secret until compatibility and destination approval succeed. Request envelopes contain a bounded request ID, operation discriminant, provider/base URL selector, validated input, and transient secret. The worker resolves the selector to its stored approval rather than accepting authorization from the page. Responses repeat request ID/operation and contain a validated neutral result or allowlisted safe error. Never serialize exception objects, raw upstream bodies, headers, or credential-bearing validation input.

The package's `RemoteAdapterError` carries `messageKey` and optional `status`, not a wire envelope. Explicitly map these allowed fields into the protocol's validated error schema and reconstruct the error in the web adapter, preserving existing provider message keys and optional status. Keep extension availability and unknown-create errors distinguishable; runtime schemas and contract-agreement tests remain protocol-owned.

Validate at both ends; transport response schemas remain inside the executing provider. Limits proposed for initial implementation: 1 MiB request envelope, 10 MiB response, four in-flight operations per document, 100 network calls per operation, 20 seconds per network request, 120 seconds per operation, and a 130-second page deadline. Exceeding a limit fails without partial-success results. Keep constants shared where necessary and use fake timers in unit tests. Bulk logs remain subject to these explicit safety limits rather than unbounded extension messaging.

Alternative: `externally_connectable` with a fixed extension ID/domain. It complicates self-hosted origin configuration and unpacked builds, so use the configurable content bridge instead.

### Approvals and network access

Manifest permissions: storage and scripting, with optional HTTP/HTTPS host access for user-selected sites/trackers; do not request access to every host at installation. Store approvals in extension-local storage keyed by exact OSI origin and provider + normalized tracker origin/base path. Local OSI HTTP is limited to loopback; other OSI origins require HTTPS. Tracker HTTP/HTTPS schemes are allowed when explicitly approved, with an HTTP credential-risk warning; no embedded username/password, query, fragment, wildcard destination, or non-HTTP scheme.

Extension UI requests browser permission during a user gesture, records the exact grant, and registers content scripts for approved sites. Browser match patterns are broader than exact ports/paths, so content and worker checks remain authoritative. Users add/review/remove website and tracker approvals in extension UI; the page cannot auto-approve. Permission denial commits no approval. Setup tells users to refresh existing OSI tabs. Startup/update reconcile registrations with current grants; revocation disconnects affected ports, rejects future network steps, and aborts in-flight fetch where possible. Already sent requests cannot be undone. Remove a browser host permission only if no remaining approval needs it.

Before every provider-derived request, resolve and canonicalize the URL, compare exact origin, and enforce base-path segment boundaries; reject traversal and ambiguous encoded separators. Check method/header allowlists for the bundled provider operations. Check response-derived pagination/form URLs too, before fetching. Use `redirect: error` and `credentials: omit`; no ambient tracker cookies or OSI session. Bound streamed response bytes before parsing JSON. Private/VPN destinations are intentionally allowed after explicit approval; this is not the server's public-network SSRF policy.

The tracker package's `normalizeBaseUrl()` only strips trailing slashes; it is not an authorization canonicalizer. Security-sensitive URL canonicalization and destination comparison belong to the extension and must not rely on that helper as a security check.

Alternative: permissive CORS proxy rules or trusting host permissions alone. Neither binds a particular OSI origin to an approved tracker base path. Refuse all redirects instead of maintaining a credential-sensitive redirect allowlist; users configure canonical tracker URLs.

### Lifecycle and export safety

Worker listeners register synchronously and load approvals as needed; do not rely on global memory surviving suspension or keep the worker alive as a daemon. Retain pending requests only in memory, drop late replies, and clean up ports/timers on document disposal. Do not automatically replay requests after reconnect. Abort on timeout/disconnect where possible, acknowledging that abort cannot roll back a remote create.

Track whether the worker has attempted the remote create. Pre-dispatch validation/approval failure is definite. Once the page hands a create to the bridge, loss of the worker's definitive reply is conservatively uncertain, even if the worker may not have sent it. Use a dedicated typed unknown-create error mapped to an actionable warning in the existing outcome surface. This may remain a `remote_failure` outcome with a distinct safe message and retry confirmation; do not overload `uncertain_finalization`, which requires a known remote ID. Preserve the existing finalization/replay flow when the ID is known.

For page reload/closure safety, record only a non-secret pending-create marker (tracker/task/date and export request key, no token, request body, or response) in the web browser before dispatch. Remove it only on a definitive non-creation or successful receipt/finalization path; surviving markers force a remote-check warning before repeat export. Markers are local safety hints, not server-side idempotency or proof of remote success. Explicit retry must acknowledge duplicate risk; no new reconciliation engine or automatic matching is introduced.

### Web and server integration

Extend the tracker mode schema/order and localized form labels; preserve default `client` and all rounding behavior. Add `ExtensionExecutionAdapter` and a client-only bridge/availability service. Shared sync/search/report callers continue using the neutral factory. SSR never starts the bridge; remote-only surfaces show setup/unavailable state after hydration, and local entry editing remains independent. Do not change persisted mode based on device detection.

Verify owned tracker mode in the server remote entry points after authentication/ownership resolution and before upstream requests; reject extension mode, with no silent fallback. Keep existing client/server contracts unchanged. No migration is needed for the text-backed mode column. Update misleading secret comments to describe all three existing/planned paths.

### Test and distribution workflow

Root commands build packages before extension output (`apps/extension/dist`) and offer focused extension unit/browser suites. Chrome/Edge Developer mode -> Load unpacked -> select output -> approve website/destination -> refresh OSI. Rebuild, reload extension, refresh page for updates. No store, domain, or live tracker is required.

Keep extension browser fixtures and suites under `apps/extension`, protocol tests under `packages/extension-protocol`, and web integration tests under `apps/web/test`. Each workspace declares its own test dependencies, including Playwright where used; do not borrow the web package's installation to run extension-owned tests.

Use Playwright bundled Chromium with a persistent isolated profile and actual extension. A local fake tracker deliberately emits no CORS headers; do not substitute page route mocks for worker network traffic. Cover all seven operations for both providers across focused worker tests, plus actual end-to-end worker connectivity for both providers, approvals/revocation, malformed messages, response-derived escape URLs, redirects, lost create replies, and credential absence from OSI traffic/storage. Keep existing provider suites as provider-quirk coverage, not duplicate them wholesale. Run manual unpacked Chrome and Edge checks because branded-browser automation sideloading differs. Desktop standalone PWA compatibility is not an acceptance gate until PWA support exists.

## Risks / Trade-offs

- Approved-origin XSS can read current browser secrets and invoke granted operations -> no stronger isolation claim; retain web CSP, tight extension approvals, and no extra credential persistence.
- Worker suspension and lost replies prevent exactly-once remote creates -> conservative uncertainty markers, no replay, explicit retry warning.
- Enterprise browser policy can block installation or hosts -> clear setup failure, no bypass or fallback.
- Strict redirect/base-path rules can reject misconfigured trackers -> canonical URL guidance and path-mounted fake-provider coverage.
- Browser permission and URL normalization semantics are easy to over-trust -> exact extension authorization checks and real browser negative tests.
- Dependency artifacts can become stale or be omitted from clean builds -> use landed public exports, ordered dependency builds/watchers, and independent clean package/extension checks.

## Migration Plan

1. Use the archived monorepo baseline and add extension/protocol workspaces against the landed public exports.
2. Build protocol, extension permissions/worker, and web integration with automated local fixtures.
3. Install unpacked locally and verify Chrome/Edge using isolated test accounts and trackers; do not contact work trackers without permission.
4. Deploy web support and install a compatible extension independently; compatibility checks handle version skew.

Existing trackers remain client/server until explicitly edited. Extension uninstall leaves ordinary tracking usable and preserves saved configuration. Before downgrading the web app to a version that does not understand `extension`, explicitly change affected tracker configurations to a supported mode; an old build must not be assumed to parse the new stored value. No automatic credential migration or database alteration is part of rollout.