import { trackerSystemTypeSchema } from '@osi/remote-trackers/contracts';
import { z } from 'zod';
import type { ApprovalState, ApprovalStore, HostPermissionPort } from './approvals.js';

export const APPROVAL_STORAGE_KEY = 'osi.approvals';

const emptyState: ApprovalState = { websites: [], destinations: [] };

const approvalStateSchema = z.object({
  websites: z.array(z.object({ origin: z.string().min(1) })),
  destinations: z.array(
    z.object({
      websiteOrigin: z.string().min(1),
      provider: trackerSystemTypeSchema,
      origin: z.string().min(1),
      basePath: z.string(),
    }),
  ),
});

/** Extension-local approval persistence; never stores operation secrets. */
export function createChromeApprovalStore(
  storage: ChromeStorageArea = chrome.storage.local,
  changes: ChromeStorageChanges = chrome.storage.onChanged,
): ApprovalStore {
  return {
    load: async () => {
      const result = await storage.get(APPROVAL_STORAGE_KEY);
      const parsed = approvalStateSchema.safeParse(result[APPROVAL_STORAGE_KEY]);
      if (!parsed.success) return emptyState;
      return parsed.data;
    },
    save: async (state) => {
      const payload = approvalStateSchema.parse(state);
      // SAFETY: validated approval state is JSON-serializable storage payload.
      await storage.set({
        [APPROVAL_STORAGE_KEY]: JSON.parse(JSON.stringify(payload)) as ChromeJson,
      });
    },
    subscribe: (listener) => {
      const onChanged: Parameters<ChromeStorageChanges['addListener']>[0] = (changed, area) => {
        if (area !== 'local' || !(APPROVAL_STORAGE_KEY in changed)) return;
        const parsed = approvalStateSchema.safeParse(changed[APPROVAL_STORAGE_KEY]?.newValue);
        listener(parsed.success ? parsed.data : emptyState);
      };
      changes.addListener(onChanged);
      return () => changes.removeListener(onChanged);
    },
  };
}

export function createChromeHostPermissions(
  permissions: ChromePermissions = chrome.permissions,
): HostPermissionPort {
  return {
    contains: async (matchPattern) => permissions.contains({ origins: [matchPattern] }),
    request: async (matchPattern) => permissions.request({ origins: [matchPattern] }),
    remove: async (matchPattern) => {
      try {
        await permissions.remove({ origins: [matchPattern] });
      } catch (err) {
        // Chrome rejects removing install-time host_permissions (used by the
        // headless browser-test profile). Optional grants still revoke.
        if (err instanceof Error && /required permissions/i.test(err.message)) return;
        throw err;
      }
    },
    list: async () => (await permissions.getAll()).origins ?? [],
    subscribe: (listener) => {
      permissions.onAdded.addListener(listener);
      permissions.onRemoved.addListener(listener);
      return () => {
        permissions.onAdded.removeListener(listener);
        permissions.onRemoved.removeListener(listener);
      };
    },
  };
}
