import { ref } from 'vue';
import { createRemoteAdapter } from '../utils/remote/create-remote-adapter';
import type { RemoteAccount } from '../../shared/types/remote-account';
import type { RemoteTimeLogDto } from '../../shared/types/remote-export';
import type { TrackerDto } from '../../shared/types/tracker';
import { extractCaughtMessageKey } from '../utils/extract-message-key';
import { useTrackerSecret } from './use-tracker-secret';

/**
 * Feature composable for browser-orchestrated remote sync: current account,
 * paginated same-day logs, and time-entry create, over the
 * `RemoteTrackerAdapter` selected for `config.executionMode`. Keeps the
 * account/logs caches and in-flight request dedup; delegates all I/O and
 * provider quirks to the adapter, which behaves identically regardless of
 * execution mode.
 */
export function useRemoteSyncClient(config: TrackerDto) {
  const { get: getSecret } = useTrackerSecret();

  const accountCache = ref<RemoteAccount | null>(null);
  const logsCache = new Map<string, RemoteTimeLogDto[]>();
  const inFlightLogs = new Map<string, Promise<RemoteTimeLogDto[]>>();
  const rangeLogsCache = new Map<string, RemoteTimeLogDto[]>();
  const inFlightRangeLogs = new Map<string, Promise<RemoteTimeLogDto[]>>();
  let accountInFlight: Promise<RemoteAccount> | null = null;

  function adapter() {
    return createRemoteAdapter(config, getSecret(config.id));
  }

  async function resolveAccount(): Promise<RemoteAccount> {
    if (accountCache.value) return accountCache.value;
    if (accountInFlight) return accountInFlight;

    accountInFlight = (async () => {
      const account = await adapter().getCurrentAccount();
      accountCache.value = account;
      return account;
    })();

    try {
      return await accountInFlight;
    } finally {
      accountInFlight = null;
    }
  }

  async function fetchTimeLogs(input: {
    spentOn: string;
    workPackageIds: string[];
  }): Promise<RemoteTimeLogDto[]> {
    const account = await resolveAccount();
    const key = `${input.spentOn}:${[...input.workPackageIds].sort().join(',')}:${account.id}`;
    const cached = logsCache.get(key);
    if (cached) return cached;

    const existing = inFlightLogs.get(key);
    if (existing) return existing;

    const promise = (async () => {
      const logs = await adapter().fetchTimeLogs({
        spentOn: input.spentOn,
        workPackageIds: input.workPackageIds,
        userId: account.id,
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
    const account = await resolveAccount();
    const key = `${input.from}:${input.to}:${account.id}`;
    const cached = rangeLogsCache.get(key);
    if (cached) return cached;

    const existing = inFlightRangeLogs.get(key);
    if (existing) return existing;

    const promise = (async () => {
      const logs = await adapter().fetchTimeLogsInRange({
        from: input.from,
        to: input.to,
        userId: account.id,
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

  function invalidateCaches(): void {
    accountCache.value = null;
    logsCache.clear();
    rangeLogsCache.clear();
  }

  return {
    resolveAccount,
    fetchTimeLogs,
    fetchTimeLogsInRange,
    createTimeEntry,
    invalidateCaches,
  };
}

/** Maps an adapter or Nitro failure to a translation key. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- catch binding is implicitly unknown
export function mapRemoteSyncClientError(err: unknown, fallback: string): string {
  return extractCaughtMessageKey(err, fallback);
}
