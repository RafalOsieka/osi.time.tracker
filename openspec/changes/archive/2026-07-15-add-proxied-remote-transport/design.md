## Context

The archived `remote-issue-linking` change (decision D1) deliberately performs OpenProject searches directly from the browser, with the API secret held only in `localStorage`. This depends on the tracker's CORS allowlist including the OSI origin. A real self-hosted deployment surfaced the failure: the OpenProject admin refuses to allowlist the user's origin, and CORS is enforced by the browser, so no client-side change can fix it. The user's host can reach OpenProject over VPN, and their OSI app runs in Docker (`docker-compose.standalone.yml`) on that same host. Server-to-server HTTP has no CORS. Connectivity testing showed the container reaches the tracker but hits a VPN internal-DNS resolution error — a deployment concern, not an architecture concern.

Current state: `remote-system-config` stores `systemType`, `baseUrl`, `executionMode` (`client` only), `roundingRule`, and `requiredFieldDefaults`, never the secret. The browser search composable reads the secret via `useRemoteConfigSecret` and calls the tracker directly. Adapter mapping already lives in transport-agnostic shared code.

## Goals / Non-Goals

**Goals:**

- Let a self-hoster search their tracker when CORS allowlisting is refused, by routing search through the OSI server (same-origin, no CORS).
- Preserve the existing `direct` browser transport unchanged for deployments where CORS is allowed.
- Keep the secret out of server persistence: forward it per request, never store it.
- Keep the server egress narrow: only the two known adapter operations, only against the user's own configured tracker.
- Map proxied failures to the established `{ messageKey, params }` API error contract.

**Non-Goals:**

- Server-side encrypted secret storage / any-browser UX (explicitly deferred).
- A generic HTTP pass-through proxy.
- Remote Sync, time-log push, or Redmine transport.
- App-level VPN/DNS handling; that stays a documented deployment concern.

## Decisions

### D1: Per-configuration `transportMode` field (`direct` | `proxied`)

Add `transportMode` to `RemoteSystemConfig`, defaulting to `direct`. The user picks the mode when configuring a Client. Search transport is selected by this field, so both models coexist without a global switch.

Alternative: global/app-level setting. Rejected — different Clients/trackers may have different CORS situations, and a per-config field is the natural home alongside `baseUrl`/`executionMode`.

Alternative: auto-detect (try direct, fall back to proxied). Rejected — CORS failures are opaque to JS (indistinguishable from network errors), so detection is unreliable and would leak retries.

### D2: Narrow, operation-specific Nitro proxy — not a generic pass-through

Expose dedicated server route(s) under `server/api/remote` for the two adapter operations only: title search and exact issue-ID lookup. The server resolves the target tracker from the authenticated user's owned configuration (by config id in the request), builds the OpenProject request server-side, and returns the adapter-neutral issue shape. The client never supplies the target URL.

Alternative: generic `/api/remote/proxy?url=...` pass-through. Rejected — it is an open SSRF vector; deriving the base URL server-side from the owned, stored config bounds egress to trackers the user already configured.

### D3: Forward-per-request secret; never persist it

In `proxied` mode the browser keeps the secret in `localStorage` (as today) and sends it on each proxied request in a dedicated request header. The server uses it only to authorize the single upstream call and never logs, serializes, or persists it. This revisits archived D1's "never send credentials to the server" rule: acceptable because OSI is single-user and self-hosted, so the browser↔server trust boundary is thin and the server is the user's own.

Alternative: server-side encrypted-at-rest secret (works from any browser). Rejected for MVP — adds key management and contradicts the browser-only-secret spec; it can be a later change.

### D4: Reuse shared adapter mapping across both transports

Both transports call the same shared request-building and response-mapping code; only the fetch executor differs (browser fetch vs. server `$fetch`). The proxy endpoint returns the already adapter-neutral shape, so the linking flow (REQ-107..110) is unchanged downstream of search.

Alternative: duplicate mapping server-side. Rejected — divergence risk.

### D5: Server-side error mapping to `{ messageKey, params }`

The proxy maps upstream auth rejection, connection failure/timeout, and not-found to distinct translated `messageKey`s (mirroring the client's direct-mode error states), thrown via `createError` with appropriate HTTP status. The picker renders the same translated states regardless of transport.

Alternative: pass raw upstream status/body to the client. Rejected — violates the API standard that clients translate `messageKey` and never receive rendered/foreign text.

## Risks / Trade-offs

- [SSRF via attacker-controlled target] → Derive base URL only from the authenticated user's stored owned config; never accept a URL from the client.
- [Secret exposure in server logs/traces] → Read the forwarded header only into the upstream request; never log request headers or the secret; keep it out of error payloads.
- [Behavior divergence between transports] → Share adapter mapping and error `messageKey`s; cover both paths in tests.
- [VPN internal DNS unresolved from the container] → Out of app scope; document `dns:`/deployment guidance for the standalone stack; app surfaces a translated connection error.
- [Widened server egress surface] → Constrain to the two known operations and the owned tracker origin; no generic proxy.
- [Migration on existing configs] → Backfill `transportMode = 'direct'` so current deployments are behavior-identical.

## Migration Plan

Add a forward migration introducing `transportMode` on the remote-system configuration with default `direct` (backfilling existing rows). Deploy the new proxy route and shared schemas, then the client transport selection and config-form field. Rollback drops the column and the proxy route; `direct`-mode deployments are unaffected, and `proxied` users revert to the prior (CORS-limited) behavior without data loss since no new persistent secret is introduced.

## Open Questions

None for the MVP proposal.
