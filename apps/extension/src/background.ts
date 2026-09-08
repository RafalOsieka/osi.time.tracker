import { ApprovalService } from './approvals/approvals.js';
import {
  createChromeApprovalStore,
  createChromeHostPermissions,
} from './approvals/chrome-store.js';
import { listenForChromePorts } from './worker/ports.js';

const approvals = new ApprovalService(createChromeApprovalStore(), createChromeHostPermissions());

listenForChromePorts({
  extensionId: chrome.runtime.id,
  approvals,
});
