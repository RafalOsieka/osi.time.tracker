/**
 * Minimal log shape needed for the possible-duplicate heuristic.
 * Matches `RemoteTimeLogDto` duration + identity fields without coupling
 * this pure helper to the full DTO.
 */
export interface DuplicateRemoteLogCandidate {
  remoteLogId: string;
  durationSeconds: number;
  comment?: string | null;
  activityName?: string | null;
}

/**
 * Returns the first same-day remote log whose duration equals `exportSeconds`,
 * or `null` when none matches. Pure client-side heuristic used only for a
 * non-blocking warning — never gates export.
 */
export function findDuplicateRemoteLog<T extends DuplicateRemoteLogCandidate>(
  exportSeconds: number,
  logs: readonly T[],
): T | null {
  if (exportSeconds <= 0 || logs.length === 0) {
    return null;
  }
  return logs.find((log) => log.durationSeconds === exportSeconds) ?? null;
}
