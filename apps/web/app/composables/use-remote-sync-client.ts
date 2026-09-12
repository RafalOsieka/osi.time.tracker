import { createRemoteAdapter } from '../utils/remote/create-remote-adapter';
import {
  RemoteAdapterError,
  type RemoteTimeEntryDeleteOutcome,
  type RemoteTimeLogDto,
} from '@osi/remote-trackers/contracts';
import type { TrackerDto } from '../../shared/types/tracker';
import { extractCaughtMessageKey } from '../utils/extract-message-key';
import { useTrackerSecret } from './use-tracker-secret';

/**
 * Feature composable for browser-orchestrated remote sync: paginated
 * same-day logs and time-entry create, over the `RemoteTrackerAdapter`
 * selected for `config.directBrowserAccess`. Log fetches rely on the
 * provider's own current-user filter (REQ-333) rather than a preceding
 * account-resolution call. Keeps the logs caches and in-flight request
 * dedup; delegates all I/O and provider quirks to the adapter, which behaves
 * identically regardless of transport.
 */
export function useRemoteSyncClient(config: TrackerDto) {
  const { get: getSecret } = useTrackerSecret();

  const logsCache = new Map<string, RemoteTimeLogDto[]>();
  const inFlightLogs = new Map<string, Promise<RemoteTimeLogDto[]>>();
  const rangeLogsCache = new Map<string, RemoteTimeLogDto[]>();
  const inFlightRangeLogs = new Map<string, Promise<RemoteTimeLogDto[]>>();

  function adapter() {
    return createRemoteAdapter(config, getSecret(config.id));
  }

  async function fetchTimeLogs(input: {
    spentOn: string;
    workPackageIds: string[];
  }): Promise<RemoteTimeLogDto[]> {
    const key = `${input.spentOn}:${[...input.workPackageIds].sort().join(',')}`;
    const cached = logsCache.get(key);
    if (cached) return cached;

    const existing = inFlightLogs.get(key);
    if (existing) return existing;

    const promise = (async () => {
      const logs = await adapter().fetchTimeLogs({
        spentOn: input.spentOn,
        workPackageIds: input.workPackageIds,
      });
      logsCache.set(key, logs);
      return logs;
    })();

    inFlightLogs.set(key, promise);
    try {
      return await promise;
    } finally {
      inFlightLogs.delete(key);
    }
  }

  async function fetchTimeLogsInRange(input: {
    from: string;
    to: string;
  }): Promise<RemoteTimeLogDto[]> {
    const key = `${input.from}:${input.to}`;
    const cached = rangeLogsCache.get(key);
    if (cached) return cached;

    const existing = inFlightRangeLogs.get(key);
    if (existing) return existing;

    const promise = (async () => {
      const logs = await adapter().fetchTimeLogsInRange({
        from: input.from,
        to: input.to,
      });
      rangeLogsCache.set(key, logs);
      return logs;
    })();

    inFlightRangeLogs.set(key, promise);
    try {
      return await promise;
    } finally {
      inFlightRangeLogs.delete(key);
    }
  }

  async function createTimeEntry(input: {
    remoteIssueId: string;
    spentOn: string;
    durationSeconds: number;
    activityId: string;
    comment?: string;
  }): Promise<{ remoteLogId: string }> {
    return adapter().createTimeEntry(input);
  }

  async function deleteTimeEntry(remoteLogId: string): Promise<RemoteTimeEntryDeleteOutcome> {
    return adapter().deleteTimeEntry(remoteLogId);
  }

  /**
   * Explicit reconciliation uses fresh data, never the display cache or a new
   * create. The fetch is already scoped to the current account (REQ-333), so
   * matching stops re-deriving that identity itself.
   */
  async function validateExistingTimeLog(input: {
    remoteLogId: string;
    remoteIssueId: string;
    spentOn: string;
    durationSeconds: number;
    activityId: string;
    comment?: string;
  }): Promise<void> {
    const remote = adapter();
    const logs = await remote.fetchTimeLogs({
      spentOn: input.spentOn,
      workPackageIds: [input.remoteIssueId],
    });
    const matches = logs.some(
      (log) =>
        log.remoteLogId === input.remoteLogId &&
        log.remoteIssueId === input.remoteIssueId &&
        log.spentOn === input.spentOn &&
        log.durationSeconds === input.durationSeconds &&
        log.activityId === input.activityId &&
        (log.comment ?? '') === (input.comment ?? ''),
    );
    if (!matches) throw new RemoteAdapterError('error.remoteExportExistingLogMismatch');
  }

  function invalidateCaches(): void {
    logsCache.clear();
    rangeLogsCache.clear();
  }

  return {
    fetchTimeLogs,
    fetchTimeLogsInRange,
    createTimeEntry,
    deleteTimeEntry,
    validateExistingTimeLog,
    invalidateCaches,
  };
}

/** Maps an adapter or Nitro failure to a translation key. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- catch binding is implicitly unknown
export function mapRemoteSyncClientError(err: unknown, fallback: string): string {
  return extractCaughtMessageKey(err, fallback);
}
