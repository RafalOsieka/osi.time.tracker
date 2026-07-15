## Why

The shipped remote-issue search calls OpenProject directly from the browser (archived `remote-issue-linking`, decision D1). That only works when the tracker's CORS allowlist includes the OSI origin. A self-hoster whose OpenProject admin refuses to allowlist their localhost origin cannot search at all, even though their host can reach the tracker over VPN. Browser CORS cannot be worked around client-side, so direct transport is a hard dead end for these users.

## What Changes

- Add a per-configuration transport mode: keep `direct` (existing browser-to-tracker behavior for admins who allow CORS) and add `proxied`.
- In `proxied` mode, the browser calls a new same-origin Nitro endpoint that forwards the two known adapter operations (title search, exact issue-ID lookup) to the configured tracker; server-to-server requests are not subject to CORS.
- Keep the secret browser-only: in `proxied` mode the browser sends the API key per request in a header to the OSI server, which forwards it to the tracker and never persists it. Revisits D1's "never send credentials to the server" stance for the single-user self-hosted model.
- Keep the proxy narrow and non-generic: validate the target base URL against the user's stored, owned configuration server-side; no open pass-through (avoids SSRF).
- Map remote/proxy failures to the `{ messageKey, params }` API error contract.
- Document VPN internal-DNS as a deployment concern for the standalone stack (no app-level DNS handling).

## Capabilities

### New Capabilities
- `remote-issue-proxy`: authenticated, CSRF-guarded, user-scoped Nitro endpoints that forward title-search and issue-ID lookups to a user's configured tracker using a forwarded per-request secret, returning the adapter-neutral issue shape.

### Modified Capabilities
- `remote-system-config`: add a `transportMode` (`direct` | `proxied`) field to the configuration and its validation, defaulting to `direct` to preserve existing behavior.
- `remote-issue-linking`: search selects transport by the configuration's `transportMode`; `proxied` routes through the OSI server while `direct` is unchanged; error/loading/empty states cover the proxied path.

## Impact

- Server: new `server/api/remote` proxy route(s), shared boundary schemas/types, config schema + migration for `transportMode`.
- Client: transport selection in the search composable, config form field, secret forwarding header.
- Security: CSP `connect-src` need not widen for `proxied` users; new server-side egress path constrained to owned configs.
- Docs: standalone-deployment note on VPN internal DNS.
