# Tasks

Each numbered group is one commit, and its tests and `en`/`pl` catalog changes land in the same commit. "Extension" tasks are extension-owned code: the worker counts as backend, popup and setup pages as frontend. "Web" tasks are the Nuxt app. Before each commit: `pnpm lint`, `pnpm type-check` and `pnpm test:unit`. Run `pnpm test:extension` for groups that touch extension pages or the worker.

## 1. Revoke confirmation (REQ-413)

- [x] 1.1 Frontend (extension): `WebsiteApprovals.vue` asks for confirmation in a `UModal` when the website has approved trackers. The modal names the website and the tracker count. Cancel and Escape return focus to the revoke button. A website without trackers is revoked directly. Verify with unit tests in `approval-panels.spec.ts` (confirm, cancel, no-tracker path).
- [x] 1.2 E2E (extension): extend `options-ui.spec.ts` to revoke a website with a tracker from the keyboard. Cancel first and assert both approvals remain, then confirm and assert both are gone.

## 2. Onboarding checklist and transient outcomes (REQ-411, REQ-412)

- [x] 2.1 Frontend (extension): remove the permanent `statusKey` from `useApprovalsEditor`. Emit outcome events instead and show them with `useToast`. Keep `errorKey` alerts. Drop the `app.statusReady` and `app.popupReady` keys. Verify with `approvals-editor.spec.ts` (outcome emitted, error stays persistent) and `i18n-catalog.spec.ts` parity.
- [x] 2.2 Frontend (extension): add `SetupChecklist.vue` (website, tracker, informational "turn off direct connection" step) and use it in `OptionsPage.vue` and `PopupPage.vue`. Hide it once both steps are done. Verify with unit tests for each checklist state and for the load-failure path.
- [x] 2.3 E2E (extension): in `options-ui.spec.ts`, assert that a fresh install shows the checklist, approving a website advances it, and approving a tracker hides it on both pages. Assert that "Open Options" text never appears.

## 3. Clickable origins (REQ-414)

- [ ] 3.1 Frontend (extension): add an `openOrigin(url, { reuseTab })` helper (design D6) and use it for website and tracker rows in the popup and setup page, with accessible link names. Verify with unit tests on a fake `chrome.tabs`/`chrome.windows` covering focusing an existing tab, the different-port case, a new tab, and tracker links always opening a new tab.
- [ ] 3.2 E2E (extension): in `options-ui.spec.ts`, open a fixture website tab, activate its link from the setup page, and assert no new tab was created. Close it, activate the link again, and assert a new tab opened.

## 4. Compact destination form (REQ-420)

- [ ] 4.1 Frontend (extension): `DestinationApprovals.vue` hides the website select when exactly one website is approved and shows "For <origin>". Shorten `approvals.destinationHelp`, `approvals.websiteHelp` and the invalid-input messages in `en` and `pl`. Verify with `approval-panels.spec.ts` (zero, one and two websites).
- [ ] 4.2 E2E (extension): update the approve flows in `options-ui.spec.ts` for the single-website form, and keep one case with two websites that uses the select.

## 5. Last tracker activity (REQ-419, REQ-313)

- [ ] 5.1 Backend (extension worker): add an `ActivityStore` on `chrome.storage.session` and record `{ at, operation, outcome }` in `handleOperation` once a destination is authorized. Delete the record when its destination is revoked. Verify with `dispatch.spec.ts` (success, timeout, adapter error, nothing recorded for a request rejected before authorization) and a store unit test.
- [ ] 5.2 Frontend (extension): show relative time, operation and outcome (or "No activity yet") on tracker rows in the popup and setup page, updating on `storage.onChanged`. Verify with unit tests for the row states.
- [ ] 5.3 E2E (extension): in `website-bridge.spec.ts`, after an operation through the fixture bridge, assert the popup shows the activity on that tracker. Assert that `chrome.storage.local` contains no activity record.

## 6. Protocol v3 and destination suggestions (REQ-421, REQ-422, REQ-309, REQ-416, REQ-417)

- [ ] 6.1 Backend (protocol): add the strict `suggest-destination` request and result schemas, parse helpers and `EXTENSION_PROTOCOL_VERSION = 3` in `packages/extension-protocol`. Verify with protocol unit tests (valid input, extra field rejected, version 2 reported as incompatible) and `pnpm package:check`.
- [ ] 6.2 Backend (extension worker): add `SuggestionService` (design D3) with deduplication, the already-approved check, a bound of 10 without eviction, pruning on website revoke, and approve and dismiss methods. Verify with unit tests for each REQ-417 scenario and for pruning.
- [ ] 6.3 Backend (extension worker): handle `suggest-destination` in `worker/ports.ts` and `dispatch.ts`. Take the website from the verified sender, reject unapproved senders and invalid destinations, and never contact the tracker. Verify with `dispatch.spec.ts` and `ports.spec.ts` covering every REQ-421 scenario.
- [ ] 6.4 Frontend (extension): add a pending-suggestions list to the setup page (approve with the HTTP warning, and dismiss) and to the popup (dismiss, plus "Approve in setup" that opens `?suggestion=<id>`, design D1). Verify with unit tests for the list, the highlight from the query, permission denied keeping the item, and dismissal.
- [ ] 6.5 Frontend (extension): compute the toolbar badge and title in `background.ts` (design D5). Verify with unit tests for the count, the attention mark, a clear state, and updates on suggestion and permission changes.
- [ ] 6.6 E2E (extension): in `website-bridge.spec.ts`, have the fixture website send a suggestion. Assert that the badge shows "1", that approving it from the setup page then lets an operation succeed, and that an unapproved fixture origin's suggestion is rejected.

## 7. Web: request approval from OSI (REQ-316, REQ-317, REQ-422)

- [ ] 7.1 Web (utility): add `suggestDestination` to `ExtensionDocumentBridge` and a `useExtensionSuggestion()` composable (design D9). Verify with unit tests for queued, alreadyApproved (triggers recheck), rejected (translated error) and v2 incompatibility.
- [ ] 7.2 Web (frontend): add the request action to unapproved required trackers in `ExtensionStatusFooter.vue` (only when the connection is ready). In `SyncDayRow.vue` and `SyncRowDetail.vue`, add it next to recheck when the error is `extensionDestinationUnapproved`. Update the `en`/`pl` catalogs. Verify with `apps/web/test/nuxt` component tests for each surface and for the hidden state when not ready.
- [ ] 7.3 E2E (web): add a UI journey with a mocked extension bridge that sends a request from the sidebar popover and asserts the "finish in the extension" message. Assert the action is absent while the extension is unavailable.
- [ ] 7.4 Docs: in `docs/self-hosting.md`, describe the popup's "approve this website" offer and the request-approval flow, and state that the web app and the extension must be updated together (protocol v3). Verify that the documented steps match the UI.

## 8. Approve the current website from the popup (REQ-415)

- [ ] 8.1 Frontend (extension): add `activeTab` to `manifest.ts`. The popup reads the active tab's origin, offers approval when it is eligible and unapproved, and opens the setup page with `?website=<origin>` pre-filled and the approve button focused. Verify with `unpacked-output.spec.ts` (manifest permission) and unit tests for eligible, approved, browser-page and non-loopback-HTTP tabs.
- [ ] 8.2 E2E (extension): in `options-ui.spec.ts`, open the setup page with `?website=` and assert the pre-filled, focused form. Approve it, then assert that denying the permission saves nothing.

## 9. Integration check

- [ ] 9.1 Run `pnpm lint`, `pnpm format:check`, `pnpm type-check`, `pnpm test:unit`, `pnpm test:nuxt`, `pnpm test:extension` and `pnpm test:e2e`, then walk the full flow manually with the unpacked extension against the local trackers.
