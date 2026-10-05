# Design

## Context

- Approvals live in `chrome.storage.local` behind `ApprovalService` (`apps/extension/src/approvals`), which serializes mutations with `navigator.locks` and notifies subscribers through `storage.onChanged`. The popup and options page share `useApprovalsEditor`.
- `useApprovalsEditor` keeps a permanent `statusKey` that starts as `app.statusReady`. That is where the leftover "Open Options…" line comes from.
- `revokeWebsite` already cascades to the website's destinations and cleans up permissions. Only the UI lacks a guard.
- Page → content script → worker: after `connect`, the content script relays a `MessagePort` to the worker port (`worker/ports.ts`). That port dispatches `handshake` and operation messages (`worker/dispatch.ts`). A new message type travels the same path; only the worker and the protocol package need to know about it.
- The web side already knows every unapproved required destination (`extension-readiness.ts`, `ExtensionStatusFooter.vue`). Sync rows show `extensionSetupGuidance` plus a recheck button on extension errors (`SyncDayRow.vue`, `SyncRowDetail.vue`).

## Goals / Non-Goals

**Goals:**
- Keep the security model unchanged: approval only in extension UI, website identity only from the verified sender, no secrets in storage.
- Add new state (suggestions, activity) behind small injectable stores, so the existing unit-test style (fake store, fake permissions) still works.

**Non-Goals:**
- No change to operation execution, limits, confinement or the in-flight queue.

## Decisions

**D1. The popup never requests permissions. Approval from the popup is a hand-off to the setup page.**
The popup opens `options/index.html?website=<origin>` or `?suggestion=<id>` with `chrome.tabs.create`. The setup page pre-fills the form or highlights the item and focuses the approve button. The user's click there is the gesture that runs `permissions.request`.
*Alternative:* call `permissions.request` from the popup. Rejected: the popup can close when the prompt takes focus, and the result is lost. That would need a spike and a fallback anyway.

**D2. Bump the protocol to version 3 (REQ-422).**
Add `suggest-destination` and `suggest-destination-result` schemas in `packages/extension-protocol`. They use strict objects (no extra keys), `requestId` for correlation, `provider` and `baseUrl`, and the result status `queued | alreadyApproved`. Failures reuse `SafeWireError` (`permission`, `malformed`, `limit`).
*Alternative:* advertise a capability flag in the handshake and keep v2. Rejected: everyone builds the extension from the same repo, the REQ-379 precedent is a hard bump, and a flag adds conditional UI on the web side.

**D3. `SuggestionService` next to `ApprovalService`.**
It has its own storage key in `chrome.storage.local`, the same lock and subscribe pattern, and items keyed by `websiteOrigin|provider|origin+basePath`. The canonicalization comes from `security/canonicalize.ts`. The bound is 10 pending items, rejected with `limit` beyond that and never evicted. Approving goes through `ApprovalService.approveDestination` and then removes the item. Revoking a website prunes its suggestions inside the same reconcile path.
*Alternative:* store suggestions inside the approval state. Rejected: that mixes trusted (user-approved) and untrusted (page-supplied) data in one record, and every approval check would have to skip them.

**D4. Activity in `chrome.storage.session`, written by `handleOperation`.**
After an authorized destination is resolved, a `finally` block writes `{ at, operation, outcome }` keyed by the destination. `outcome` is `ok` or the `SafeWireError.kind`. Requests rejected before authorization write nothing (REQ-419). Revoking a destination deletes its key. Pages read the record through a small `ActivityStore` and subscribe to `storage.onChanged` (area `session`).
*Alternative:* keep it in worker memory. Rejected: the MV3 worker is evicted after about 30 s idle, so the record would vanish unpredictably.

**D5. The badge is computed in `background.ts`.**
`refreshBadge()` reads pending suggestions and missing host permissions, then sets `chrome.action.setBadgeText`, the badge color (warning) and `setTitle` from the extension i18n catalog. It runs after reconciliation, on suggestion changes, on `permissions.onAdded` and `onRemoved`, and on locale changes.

**D6. Origins open through one helper, `openOrigin(url, { reuseTab })`.**
Website links call `chrome.tabs.query({ url: origin + '/*' })`, which works without the `tabs` permission because the host permission is granted. The helper filters to exact-origin matches (the port matters), then calls `tabs.update` and `windows.update` to focus, or `tabs.create`. Tracker links always create a new tab. If the host permission is missing, the query returns nothing and a new tab opens, which is acceptable.

**D7. `activeTab` for the current-website offer.**
`activeTab` adds no install-time warning and exposes `tab.url` only after the user clicks the action. Eligibility reuses `canonicalizeWebsiteOrigin`.

**D8. The checklist and toasts replace `statusKey`.**
`useApprovalsEditor` stops exposing a permanent status. It emits outcome events that pages show through Nuxt UI `useToast` (rendered by the existing `UApp`). `errorKey` alerts stay. The checklist is a shared `SetupChecklist.vue` used by both pages. The revoke confirmation uses `UModal`.

**D9. One web composable for "request approval".**
`useExtensionSuggestion()` wraps `ExtensionDocumentBridge.suggestDestination` and maps the result to a translated message, or to `recheck()` for `alreadyApproved`. It is used by `ExtensionStatusFooter.vue`, `SyncDayRow.vue` and `SyncRowDetail.vue`.

## Risks / Trade-offs

- [The v3 bump breaks mixed versions] → An intended, visible incompatibility state. The README/self-hosting note says to rebuild the extension together with the web update.
- [An approved website can fill the suggestion list] → The bound of 10, deduplication, and dismissal. Suggestions never grant anything.
- [Toasts are easy to miss for screen-reader users] → Nuxt UI toasts use a live region. Errors that need action stay as alerts.
- [`tabs.query` by URL misses a tab whose host permission was revoked] → It falls back to a new tab. Nothing breaks.

## Migration Plan

No data migration. Existing approvals keep working. Ship the web app and the extension together. A rollback restores both at v2.
