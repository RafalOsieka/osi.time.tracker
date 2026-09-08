import { trackerSystemTypeSchema } from '@osi/remote-trackers/contracts';
import { z } from 'zod';
import { type ApprovalState, type ApprovalStore, type HostPermissionPort } from './approvals.js';

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
): ApprovalStore {
  return {
    load: async () => {
      const result = await storage.get(APPROVAL_STORAGE_KEY);
      const parsed = approvalStateSchema.safeParse(result[APPROVAL_STORAGE_KEY]);
      if (!parsed.success) return emptyState;
      return parsed.data;
    },
    save: async (state) => {
      await storage.set({ [APPROVAL_STORAGE_KEY]: state });
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
      await permissions.remove({ origins: [matchPattern] });
    },
    list: async () => (await permissions.getAll()).origins ?? [],
  };
}
