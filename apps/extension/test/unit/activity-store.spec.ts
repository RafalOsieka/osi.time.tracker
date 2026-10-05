import { describe, expect, it } from 'vite-plus/test';
import {
  ACTIVITY_STORAGE_KEY,
  createChromeActivityStore,
  createMemoryActivityStore,
  type ActivityRecord,
} from '../../src/activity/activity-store.js';
import { destinationKey, type DestinationApproval } from '../../src/approvals/approvals.js';

const kept: DestinationApproval = {
  websiteOrigin: 'https://time.example.com',
  provider: 'redmine',
  origin: 'https://rm.example.com',
  basePath: '',
};
const revoked: DestinationApproval = { ...kept, basePath: '/old' };
const entry: ActivityRecord = {
  at: '2026-10-05T10:00:00.000Z',
  operation: 'fetchTimeLogs',
  outcome: 'ok',
};

describe('activity store', () => {
  it('keeps one record per destination and prunes revoked destinations', async () => {
    const store = createMemoryActivityStore();
    await Promise.all([store.record(kept, entry), store.record(revoked, entry)]);
    expect(Object.keys(await store.load())).toHaveLength(2);

    await store.prune([kept]);
    expect(await store.load()).toEqual({ [destinationKey(kept)]: entry });
  });

  it('reads only well-formed records from session storage', async () => {
    const items = new Map<string, ChromeJson>([
      [ACTIVITY_STORAGE_KEY, { [destinationKey(kept)]: { at: 'yesterday', outcome: 'ok' } }],
    ]);
    const session: ChromeStorageArea = {
      get: async (key) => ({ [key]: items.get(key) }),
      set: async (values) => {
        for (const [key, value] of Object.entries(values)) items.set(key, value);
      },
    };
    const store = createChromeActivityStore(session, {
      addListener: () => {},
      removeListener: () => {},
    });
    expect(await store.load()).toEqual({});

    await store.record(kept, entry);
    expect(await store.load()).toEqual({ [destinationKey(kept)]: entry });
  });
});
