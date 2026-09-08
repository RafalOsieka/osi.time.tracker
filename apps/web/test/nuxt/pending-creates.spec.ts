import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { locks } from 'node:worker_threads';
import {
  createPendingCreateStore,
  ExportRecoveryStorageError,
  PENDING_CREATE_STORAGE_KEY,
  type PendingCreateMarker,
} from '../../app/utils/remote/pending-creates';

// Use browser storage rather than Node's unconfigured global localStorage.
beforeEach(() => {
  vi.stubGlobal('localStorage', new Window().localStorage);
  vi.stubGlobal('navigator', { locks });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const legacy: PendingCreateMarker = {
  trackerId: 'tracker',
  taskId: 'task',
  spentOn: '2026-03-15',
  exportRequestKey: 'legacy',
};

describe('pending creates', () => {
  it('retains entry IDs across store recreation alongside legacy markers', async () => {
    window.localStorage.setItem(PENDING_CREATE_STORAGE_KEY, JSON.stringify([legacy]));
    const current = { ...legacy, exportRequestKey: 'current', entryIds: ['entry-1', 'entry-2'] };
    await createPendingCreateStore().transaction((markers) => markers.push(current));
    const reloaded = createPendingCreateStore();
    expect(reloaded.list()).toEqual([legacy, current]);
    await reloaded.transaction((markers) => markers.splice(1, 1));
    expect(reloaded.list()).toEqual([legacy]);
  });

  it('serializes cross-store check/reservations using Web Locks', async () => {
    const first = createPendingCreateStore();
    const second = createPendingCreateStore();
    const reserve = (markers: PendingCreateMarker[]) => {
      if (markers.length) return false;
      markers.push(legacy);
      return true;
    };
    expect(await Promise.all([first.transaction(reserve), second.transaction(reserve)])).toEqual([
      true,
      false,
    ]);
    expect(first.list()).toEqual([legacy]);
  });

  it('does not lose unrelated concurrent mutations', async () => {
    const first = createPendingCreateStore();
    const second = createPendingCreateStore();
    const unrelated = { ...legacy, exportRequestKey: 'other', taskId: 'other' };
    await first.transaction((markers) => markers.push(legacy));
    await Promise.all([
      first.transaction((markers) => markers.splice(0, 1)),
      second.transaction((markers) => markers.push(unrelated)),
    ]);
    expect(first.list()).toEqual([unrelated]);
  });

  it('fails closed when locking is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const update = vi.fn();
    await expect(createPendingCreateStore().transaction(update)).rejects.toBeInstanceOf(
      ExportRecoveryStorageError,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it.each(['not-json', '{}', '[{"trackerId":"broken"}]'])(
    'fails closed on corrupt storage: %s',
    async (raw) => {
      window.localStorage.setItem(PENDING_CREATE_STORAGE_KEY, raw);
      const store = createPendingCreateStore();
      expect(() => store.list()).toThrow(ExportRecoveryStorageError);
      await expect(store.transaction((markers) => markers.push(legacy))).rejects.toBeInstanceOf(
        ExportRecoveryStorageError,
      );
      expect(window.localStorage.getItem(PENDING_CREATE_STORAGE_KEY)).toBe(raw);
    },
  );

  it.each(['getItem', 'setItem'] as const)('surfaces %s storage failures', async (method) => {
    vi.spyOn(window.localStorage, method).mockImplementation(() => {
      throw new Error('storage denied');
    });
    await expect(
      createPendingCreateStore().transaction((markers) => markers.push(legacy)),
    ).rejects.toBeInstanceOf(ExportRecoveryStorageError);
  });

  it('round-trips known IDs and original payloads, stripping credentials from records', async () => {
    const marker = {
      ...legacy,
      apiKey: 'secret-never-store',
      recovery: {
        attemptId: 'attempt',
        status: 'known' as const,
        remoteLogId: 'remote',
        config: {
          id: 'tracker',
          name: 'Tracker',
          systemType: 'openproject' as const,
          baseUrl: 'https://tracker.example',
          executionMode: 'extension' as const,
          roundingRule: 'none' as const,
          createdAt: '',
          updatedAt: '',
          apiKey: 'secret-never-store',
        },
        payload: {
          taskId: 'task',
          localDate: '2026-03-15',
          remoteIssueId: '42',
          exportDurationSeconds: 3600,
          requiredFieldValues: { activity: '1' },
          entryIds: ['entry'],
          exportRequestKey: 'legacy',
          comment: 'Original note',
        },
      },
    };
    await createPendingCreateStore().transaction((markers) => markers.push(marker));
    const reloaded = createPendingCreateStore().list();
    expect(reloaded[0]?.recovery).toMatchObject({
      status: 'known',
      remoteLogId: 'remote',
      payload: marker.recovery.payload,
    });
    expect(window.localStorage.getItem(PENDING_CREATE_STORAGE_KEY)).not.toContain(
      'secret-never-store',
    );
  });
});
