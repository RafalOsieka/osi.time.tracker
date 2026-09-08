import { describe, expect, it, vi } from 'vitest';
import { ApprovalService, createMemoryHostPermissions } from '../../src/approvals/approvals.js';
import {
  APPROVAL_STORAGE_KEY,
  createChromeApprovalStore,
} from '../../src/approvals/chrome-store.js';

describe('Chrome approval changes', () => {
  it('cancels worker work after an options-context storage change and releases the listener', async () => {
    const listeners = new Set<Parameters<ChromeStorageChanges['addListener']>[0]>();
    const changes: ChromeStorageChanges = {
      addListener: (listener) => {
        listeners.add(listener);
      },
      removeListener: (listener) => {
        listeners.delete(listener);
      },
    };
    let stored: ChromeJson = { websites: [], destinations: [] };
    const storage: ChromeStorageArea = {
      get: async () => ({ [APPROVAL_STORAGE_KEY]: stored }),
      set: async (items) => {
        stored = items[APPROVAL_STORAGE_KEY] ?? null;
        for (const listener of listeners)
          listener({ [APPROVAL_STORAGE_KEY]: { newValue: stored } }, 'local');
      },
    };
    const permissions = createMemoryHostPermissions();
    const editor = new ApprovalService(createChromeApprovalStore(storage, changes), permissions);
    const worker = new ApprovalService(createChromeApprovalStore(storage, changes), permissions);
    const website = 'http://localhost:3000';
    await editor.approveWebsite(website);
    const approval = await editor.approveDestination(
      website,
      'redmine',
      'https://tracker.example/redmine',
    );
    const abort = vi.fn();
    worker.registerInFlight(approval, { abort });
    expect(listeners.size).toBe(1);
    for (const listener of listeners) {
      listener({ [APPROVAL_STORAGE_KEY]: {} }, 'sync');
      listener({ preference: {} }, 'local');
    }
    expect(abort).not.toHaveBeenCalled();
    await editor.revokeWebsite(website);
    expect(abort).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
  });
});
