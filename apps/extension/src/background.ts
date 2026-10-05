import { createChromeActivityStore } from './activity/activity-store.js';
import { LOCALE_MIRROR_KEY, readMirroredLocale, refreshBadge } from './badge/toolbar-badge.js';
import { ApprovalService } from './approvals/approvals.js';
import {
  createChromeApprovalStore,
  createChromeHostPermissions,
} from './approvals/chrome-store.js';
import { SuggestionService, createChromeSuggestionStore } from './suggestions/suggestions.js';
import { listenForChromePorts } from './worker/ports.js';
import { reconcileWebsiteContentScripts } from './content/registration.js';

const approvals = new ApprovalService(createChromeApprovalStore(), createChromeHostPermissions());
const activity = createChromeActivityStore();
const suggestions = new SuggestionService(createChromeSuggestionStore(), approvals);
let reconciliation = Promise.resolve();
let badgeUpdate = Promise.resolve();

function scheduleBadge(): void {
  badgeUpdate = badgeUpdate
    .then(() =>
      refreshBadge({
        approvals,
        suggestions,
        action: chrome.action,
        locale: () => readMirroredLocale(),
      }),
    )
    .catch(() => {
      console.warn('Extension toolbar badge update failed');
    });
}

function scheduleReconciliation(): void {
  reconciliation = reconciliation
    .then(async () => {
      await approvals.reconcile();
      const state = await approvals.list();
      await activity.prune(state.destinations);
      await suggestions.prune();
      const granted = await Promise.all(
        state.websites.map(async (website) =>
          (await approvals.hasHostPermission(website.origin)) ? website.origin : undefined,
        ),
      );
      await reconcileWebsiteContentScripts(granted.filter((origin) => origin !== undefined));
      scheduleBadge();
    })
    .catch(() => {
      // Keep diagnostics credential-free and allow the next lifecycle event to retry.
      console.warn('Extension approval reconciliation failed');
    });
}

chrome.runtime.onStartup.addListener(scheduleReconciliation);
chrome.runtime.onInstalled.addListener(scheduleReconciliation);
approvals.subscribe(scheduleReconciliation);
suggestions.subscribe(scheduleBadge);
chrome.storage.onChanged.addListener((changed, area) => {
  if (area === 'local' && LOCALE_MIRROR_KEY in changed) scheduleBadge();
});

listenForChromePorts({
  extensionId: chrome.runtime.id,
  approvals,
  activity,
  suggestions,
});

scheduleReconciliation();
