# Proposal

## Why

The extension now looks like OSI, but setting it up still takes too many manual steps. The user copies the OSI origin and each tracker URL into a form, even though OSI already knows which tracker destinations are missing. The setup page shows a leftover "Open Options…" line on the options page itself. One unconfirmed click on a website's trash icon deletes every tracker approved for it. And when a sync fails, nothing in the extension shows whether a tracker request reached it or how it ended.

## What Changes

- **Revoke confirmation:** revoking a website that still has approved trackers asks for confirmation and names how many trackers go with it.
- **Onboarding checklist:** replaces the permanent status line on the setup page and the "Extension is loaded" text in the popup. Outcomes of actions are announced briefly instead.
- **Clickable origins:** website and tracker URLs open in a tab. If an OSI tab is already open, the extension switches to it instead of opening a new one.
- **Toolbar badge:** the toolbar icon shows when setup needs attention (missing site access or pending tracker suggestions).
- **Compact destination form:** the website select is hidden when only one website is approved. Help texts are shortened.
- **Last activity per tracker:** time, operation and outcome code of the latest request, kept only for the browser session.
- **Tracker suggestions:** an approved OSI website can ask the extension to approve a tracker destination. The request comes from a user action in the sidebar popover or in a contextual extension error. The extension queues the suggestion. The user approves or dismisses it in extension UI. **BREAKING:** the bridge protocol version goes to 3, so older extensions and older websites show the existing incompatibility state.
- **Approve the current website:** the popup offers to approve the active tab's origin. Confirming opens the setup page with that origin pre-filled, and the permission prompt runs there.

## Non-goals

- Injecting the bridge into already open tabs. "Refresh your OSI tabs" stays.
- A timer or any OSI server access from the extension.
- Request counters or long-term statistics.
- Suggestions from websites that are not approved, or approval without the extension's own UI.

## Capabilities

### New Capabilities

- `remote-extension-setup`: the extension-owned setup experience: onboarding, current-website approval, the tracker suggestion inbox, revoke confirmation, toolbar badge, links and last-activity display.

### Modified Capabilities

- `remote-browser-extension`: the bridge gains the suggestion message under protocol v3 (REQ-309). The sidebar popover (REQ-316) and contextual failures (REQ-317) can send a suggestion. Storage rules (REQ-313) cover suggestions and session activity.

## Impact

- `packages/extension-protocol`: new `suggest-destination` envelope and its result, version 3.
- `apps/extension`: popup, options page, approval components, worker dispatch and ports, background badge, `activeTab` permission, i18n `en`/`pl`.
- `apps/web`: extension bridge client, `ExtensionStatusFooter.vue`, contextual extension errors, i18n `en`/`pl`.
- Users must rebuild and reload the extension together with the web update.
