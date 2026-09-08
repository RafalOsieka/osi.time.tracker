import { z } from 'zod';

export const PENDING_CREATE_STORAGE_KEY = 'osi:pending-creates';

export const pendingCreateMarkerSchema = z.object({
  trackerId: z.string().min(1),
  taskId: z.string().min(1),
  spentOn: z.string().min(1),
  exportRequestKey: z.string().min(1),
});

export type PendingCreateMarker = z.infer<typeof pendingCreateMarkerSchema>;

const pendingCreateListSchema = z.array(pendingCreateMarkerSchema);

export interface PendingCreateStore {
  list(): PendingCreateMarker[];
  has(exportRequestKey: string): boolean;
  add(marker: PendingCreateMarker): void;
  remove(exportRequestKey: string): void;
}

function readAll(): PendingCreateMarker[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(PENDING_CREATE_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = pendingCreateListSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function writeAll(markers: PendingCreateMarker[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PENDING_CREATE_STORAGE_KEY, JSON.stringify(markers));
}

/**
 * Browser-only, secret-free record of creates that were handed to the
 * extension bridge. Surviving markers after reload stay uncertain.
 */
export function createPendingCreateStore(): PendingCreateStore {
  return {
    list() {
      return readAll();
    },
    has(exportRequestKey: string) {
      return readAll().some((marker) => marker.exportRequestKey === exportRequestKey);
    },
    add(marker: PendingCreateMarker) {
      const parsed = pendingCreateMarkerSchema.safeParse(marker);
      if (!parsed.success) return;
      const next = readAll().filter(
        (item) => item.exportRequestKey !== parsed.data.exportRequestKey,
      );
      next.push(parsed.data);
      writeAll(next);
    },
    remove(exportRequestKey: string) {
      writeAll(readAll().filter((marker) => marker.exportRequestKey !== exportRequestKey));
    },
  };
}
