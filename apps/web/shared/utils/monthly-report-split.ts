export interface ReportRemoteLog {
  remoteLogId: string;
  spentOn: string;
  durationSeconds: number;
}

export function knownRemoteLogIdsForTracker(
  exports: readonly { trackerId: string; remoteLogId: string }[],
  trackerId: string,
): Set<string> {
  return new Set(
    exports.filter((item) => item.trackerId === trackerId).map((item) => item.remoteLogId),
  );
}

export interface TrackerDayHours {
  appSeconds: number;
  directSeconds: number;
}

/**
 * Split live remote logs into App (known export ids) vs Direct (unrecognized).
 * Keys are `spentOn` calendar days.
 */
export function splitAppAndDirect(
  logs: readonly ReportRemoteLog[],
  knownRemoteLogIds: ReadonlySet<string>,
): Map<string, TrackerDayHours> {
  const byDay = new Map<string, TrackerDayHours>();
  for (const log of logs) {
    const bucket = byDay.get(log.spentOn) ?? { appSeconds: 0, directSeconds: 0 };
    if (knownRemoteLogIds.has(log.remoteLogId)) {
      bucket.appSeconds += log.durationSeconds;
    } else {
      bucket.directSeconds += log.durationSeconds;
    }
    byDay.set(log.spentOn, bucket);
  }
  return byDay;
}
