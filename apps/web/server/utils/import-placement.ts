/**
 * Placement rule for remote-log import (REQ-337): imported entries for one
 * local day are placed back to back, ordered by numeric remote log id
 * ascending, starting from whichever is later of a fixed 08:00 anchor or the
 * day's latest existing stopped entry — so two trackers imported in either
 * order, or a day with real local entries, never overlap. A single entry may
 * legitimately end after local midnight (it still starts today); the anchor
 * drops to `dayStart` only when the *last* entry in the sequence would
 * otherwise start on the following local day.
 */

export interface PlaceableLog {
  remoteLogId: string;
  durationSeconds: number;
}

export interface PlacedLog<T extends PlaceableLog> {
  log: T;
  startedAt: Date;
  stoppedAt: Date;
}

const ANCHOR_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Ascending by numeric remote log id; falls back to lexical order for non-numeric ids. */
function compareRemoteLogId(a: string, b: string): number {
  const numericA = Number(a);
  const numericB = Number(b);
  if (Number.isFinite(numericA) && Number.isFinite(numericB)) {
    return numericA - numericB;
  }
  return a.localeCompare(b);
}

/**
 * Places one local day's imported logs, ordered by numeric remote log id,
 * back to back from a cursor that starts at the later of `dayStart + 08:00`
 * and `existingMaxStop`. If placing every log from there would start the
 * *last* one on or after `dayEnd`, the cursor instead starts at the later of
 * `dayStart` and `existingMaxStop` — a single long entry is left to end after
 * midnight rather than losing the 08:00 anchor for no reason.
 */
export function placeImportedEntries<T extends PlaceableLog>(
  dayStart: Date,
  dayEnd: Date,
  existingMaxStop: Date | null,
  logs: T[],
): PlacedLog<T>[] {
  const anchor = new Date(dayStart.getTime() + ANCHOR_OFFSET_MS);
  const laterThan = (a: Date, b: Date | null) => (b != null && b.getTime() > a.getTime() ? b : a);

  const sorted = [...logs].sort((a, b) => compareRemoteLogId(a.remoteLogId, b.remoteLogId));

  let cursor = laterThan(anchor, existingMaxStop);

  const lastLog = sorted[sorted.length - 1];
  if (lastLog) {
    const totalDurationMs = sorted.reduce((sum, log) => sum + log.durationSeconds * 1000, 0);
    const lastEntryStart = cursor.getTime() + totalDurationMs - lastLog.durationSeconds * 1000;
    if (lastEntryStart >= dayEnd.getTime()) {
      cursor = laterThan(dayStart, existingMaxStop);
    }
  }

  const placed: PlacedLog<T>[] = [];
  for (const log of sorted) {
    const startedAt = new Date(cursor.getTime());
    const stoppedAt = new Date(cursor.getTime() + log.durationSeconds * 1000);
    placed.push({ log, startedAt, stoppedAt });
    cursor = stoppedAt;
  }
  return placed;
}
