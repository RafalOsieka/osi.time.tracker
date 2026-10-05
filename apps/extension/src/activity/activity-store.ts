import { extensionErrorKindSchema, operationNameSchema } from '@osi/extension-protocol';
import { z } from 'zod';
import { destinationKey, type DestinationApproval } from '../approvals/approvals.js';

export const ACTIVITY_STORAGE_KEY = 'osi.activity';
const ACTIVITY_LOCK = 'osi-extension-activity';

/**
 * The latest operation on one approved destination. Only the operation name, its time and its
 * outcome are kept: never a request or response body, a credential, or a URL.
 */
export const activityRecordSchema = z.object({
  at: z.iso.datetime(),
  operation: operationNameSchema,
  outcome: z.union([z.literal('ok'), extensionErrorKindSchema]),
});

export type ActivityRecord = z.infer<typeof activityRecordSchema>;

const activityMapSchema = z.record(z.string(), activityRecordSchema);

/** Latest activity per destination, keyed by `destinationKey`. */
export type ActivityMap = z.infer<typeof activityMapSchema>;

export interface ActivityStore {
  record(approval: DestinationApproval, entry: ActivityRecord): Promise<void>;
  load(): Promise<ActivityMap>;
  /** Drops records of destinations that are no longer approved. */
  prune(approved: readonly DestinationApproval[]): Promise<void>;
  subscribe(listener: (activity: ActivityMap) => void): () => void;
}

interface ActivityArea {
  read(): Promise<ActivityMap>;
  write(activity: ActivityMap): Promise<void>;
  subscribe(listener: (activity: ActivityMap) => void): () => void;
}

function parseActivity(value: ChromeJson | undefined): ActivityMap {
  const parsed = activityMapSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

function createActivityStore(area: ActivityArea): ActivityStore {
  // Operations finish concurrently; serialize read-modify-write so no record is lost.
  const update = (change: (activity: ActivityMap) => ActivityMap) =>
    navigator.locks.request(ACTIVITY_LOCK, async () => {
      await area.write(change(await area.read()));
    });
  return {
    record: (approval, entry) =>
      update((activity) => ({ ...activity, [destinationKey(approval)]: entry })),
    load: () => area.read(),
    prune: (approved) => {
      const keep = new Set(approved.map(destinationKey));
      return update((activity) =>
        Object.fromEntries(Object.entries(activity).filter(([key]) => keep.has(key))),
      );
    },
    subscribe: (listener) => area.subscribe(listener),
  };
}

/** Session-only activity: `chrome.storage.session` is cleared when the browser closes. */
export function createChromeActivityStore(
  storage: ChromeStorageArea = chrome.storage.session,
  changes: ChromeStorageChanges = chrome.storage.onChanged,
): ActivityStore {
  return createActivityStore({
    read: async () =>
      parseActivity((await storage.get(ACTIVITY_STORAGE_KEY))[ACTIVITY_STORAGE_KEY]),
    write: async (activity) => {
      // SAFETY: the map was built from parsed records, which hold only JSON primitives.
      await storage.set({ [ACTIVITY_STORAGE_KEY]: activity as ChromeJson });
    },
    subscribe: (listener) => {
      const onChanged: Parameters<ChromeStorageChanges['addListener']>[0] = (changed, area) => {
        if (area !== 'session' || !(ACTIVITY_STORAGE_KEY in changed)) return;
        listener(parseActivity(changed[ACTIVITY_STORAGE_KEY]?.newValue));
      };
      changes.addListener(onChanged);
      return () => changes.removeListener(onChanged);
    },
  });
}

export function createMemoryActivityStore(): ActivityStore {
  let current: ActivityMap = {};
  const listeners = new Set<(activity: ActivityMap) => void>();
  return createActivityStore({
    read: async () => current,
    write: async (activity) => {
      current = activity;
      for (const listener of listeners) listener(activity);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
