import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import {
  createPendingCreateStore,
  PENDING_CREATE_STORAGE_KEY,
} from '../../app/utils/remote/pending-creates';

// Use browser storage rather than Node's unconfigured global localStorage.
beforeEach(() => vi.stubGlobal('localStorage', new Window().localStorage));
afterEach(() => vi.unstubAllGlobals());

describe('pending creates', () => {
  it('retains entry IDs across store recreation alongside legacy markers', () => {
    const legacy = {
      trackerId: 'tracker',
      taskId: 'task',
      spentOn: '2026-03-15',
      exportRequestKey: 'legacy',
    };
    window.localStorage.setItem(PENDING_CREATE_STORAGE_KEY, JSON.stringify([legacy]));
    const current = { ...legacy, exportRequestKey: 'current', entryIds: ['entry-1', 'entry-2'] };
    createPendingCreateStore().add(current);
    const reloaded = createPendingCreateStore();
    expect(reloaded.list()).toEqual([legacy, current]);
    reloaded.remove('current');
    expect(reloaded.list()).toEqual([legacy]);
  });
});
