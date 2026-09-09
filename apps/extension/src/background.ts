import { ApprovalService } from './approvals/approvals.js';
import {
  createChromeApprovalStore,
  createChromeHostPermissions,
} from './approvals/chrome-store.js';
import { listenForChromePorts } from './worker/ports.js';
import { reconcileWebsiteContentScripts } from './content/registration.js';

const approvals = new ApprovalService(createChromeApprovalStore(), createChromeHostPermissions());
let reconciliation = Promise.resolve();

function scheduleReconciliation(): void {
  reconciliation = reconciliation
    .then(async () => {
      await approvals.reconcile();
      const state = await approvals.list();
      const granted = await Promise.all(
        state.websites.map(async (website) =>
          (await approvals.hasHostPermission(website.origin)) ? website.origin : undefined,
        ),
      );
      await reconcileWebsiteContentScripts(granted.filter((origin) => origin !== undefined));
    })
    .catch(() => {
      // Keep diagnostics credential-free and allow the next lifecycle event to retry.
      console.warn('Extension approval reconciliation failed');
    });
}

chrome.runtime.onStartup.addListener(scheduleReconciliation);
chrome.runtime.onInstalled.addListener(scheduleReconciliation);
approvals.subscribe(scheduleReconciliation);

listenForChromePorts({
  extensionId: chrome.runtime.id,
  approvals,
});

scheduleReconciliation();
