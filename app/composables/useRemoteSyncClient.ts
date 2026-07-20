import { ref } from 'vue';
import { createRemoteAdapter } from '../utils/remote/create-remote-adapter';
import { extractRemoteErrorKey } from '../utils/remote/extract-remote-error-key';
import type { RemoteAccount } from '../../shared/types/remote-account';
import type { RemoteTimeLogDto } from '../../shared/types/remote-export';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';
import { useRemoteConfigSecret } from './useRemoteConfigSecret';

/**
 * Feature composable for browser-orchestrated remote sync: current account,
 * paginated same-day logs, and time-entry create, over the
 * `RemoteTrackerAdapter` selected for `config.executionMode`. Keeps the
 * account/logs caches and in-flight request dedup; delegates all I/O and
 * provider quirks to the adapter, which behaves identically regardless of
 * execution mode.
 */
export function useRemoteSyncClient(config: RemoteSystemConfigDto) {
  const { get: getSecret } = useRemoteConfigSecret();

  const accountCache = ref<RemoteAccount | null>(null);
  const logsCache = new Map<string, RemoteTimeLogDto[]>();
  const inFlightLogs = new Map<string, Promise<RemoteTimeLogDto[]>>();
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
  }

  return {
    resolveAccount,
    fetchTimeLogs,
    createTimeEntry,
    invalidateCaches,
  };
}

/** Maps any failure (adapter or local) to a translation key. */
export function mapRemoteSyncClientError(err: unknown, fallback: string): string {
  return extractRemoteErrorKey(err, fallback);
}
