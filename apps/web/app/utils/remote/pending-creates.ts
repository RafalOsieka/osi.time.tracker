import { z } from 'zod';
import { finalizeRemoteExportSchema } from '../../../shared/types/remote-export';
import { createTrackerSchema } from '../../../shared/types/tracker';

export const PENDING_CREATE_STORAGE_KEY = 'osi:pending-creates';

export const recoveryTrackerSchema = createTrackerSchema.extend({
  id: z.string().min(1),
  // Sync configurations omit the display name; only destination fields authorize remote calls.
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  baseUrl: z.url().refine((value) => {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash;
  }),
});

// Recovery contains only the local finalization fields, never tracker credentials or envelopes.
export const exportRecoveryPayloadSchema = finalizeRemoteExportSchema
  .omit({ remoteLogId: true })
  .extend({
    taskId: z.string().min(1),
    entryIds: z.array(z.string().min(1)),
    requiredFieldValues: z.object({ activity: z.string().min(1) }),
  });

const recoveryAttemptSchema = z.object({
  attemptId: z.string().min(1),
  payload: exportRecoveryPayloadSchema,
  config: recoveryTrackerSchema,
});

export const pendingCreateMarkerSchema = z.object({
  trackerId: z.string().min(1),
  taskId: z.string().min(1),
  spentOn: z.string().min(1),
  exportRequestKey: z.string().min(1),
  // Older markers still protect their tracker/task/day without entry IDs.
  entryIds: z.array(z.string().min(1)).optional(),
  recovery: z
    .discriminatedUnion('status', [
      recoveryAttemptSchema.extend({ status: z.literal('unknown') }),
      recoveryAttemptSchema.extend({ status: z.literal('known'), remoteLogId: z.string().min(1) }),
    ])
    .optional(),
});

export type PendingCreateMarker = z.infer<typeof pendingCreateMarkerSchema>;
export type ExportRecoveryPayload = z.infer<typeof exportRecoveryPayloadSchema>;

const pendingCreateListSchema = z.array(pendingCreateMarkerSchema);

export interface PendingCreateStore {
  list(): PendingCreateMarker[];
  /** Atomic read/check/write. Callback must be synchronous; no network work under this lock. */
  transaction<T>(update: (markers: PendingCreateMarker[]) => T): Promise<T>;
}

export class ExportRecoveryStorageError extends Error {
  readonly messageKey = 'error.exportRecoveryUnavailable';
}

export function pendingCreateIdentity(marker: PendingCreateMarker): string {
  return marker.recovery?.attemptId ?? marker.exportRequestKey;
}

function readAll(): PendingCreateMarker[] {
  try {
    if (!import.meta.client) throw new ExportRecoveryStorageError();
    const raw = window.localStorage.getItem(PENDING_CREATE_STORAGE_KEY);
    if (!raw) return [];
    return pendingCreateListSchema.parse(JSON.parse(raw));
  } catch (cause) {
    throw new ExportRecoveryStorageError('Cannot read export recovery', { cause });
  }
}

/**
 * Browser-only durable recovery. Every mutation, including reservations, shares a Web Lock
 * across tabs. Missing locks/storage and corrupt records fail closed, including during SSR.
 */
export function createPendingCreateStore(): PendingCreateStore {
  return {
    list: readAll,
    async transaction(update) {
      try {
        if (!import.meta.client || !navigator.locks) {
          throw new ExportRecoveryStorageError();
        }
        return await navigator.locks.request(PENDING_CREATE_STORAGE_KEY, async () => {
          const markers = readAll();
          const before = JSON.stringify(markers);
          const result = update(markers);
          const after = JSON.stringify(pendingCreateListSchema.parse(markers));
          if (after !== before) window.localStorage.setItem(PENDING_CREATE_STORAGE_KEY, after);
          return result;
        });
      } catch (cause) {
        throw new ExportRecoveryStorageError('Cannot update export recovery', { cause });
      }
    },
  };
}
