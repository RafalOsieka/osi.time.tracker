import { ref, type Ref } from 'vue';
import type { RemoteTimeLogDto } from '../../shared/types/remote-export';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';
import { mapRemoteSyncClientError, useRemoteSyncClient } from './useRemoteSyncClient';

export interface RemoteDayLogsState {
  logs: RemoteTimeLogDto[];
  loading: boolean;
  errorKey: string | null;
  loaded: boolean;
}

const EMPTY_LOGS_STATE: RemoteDayLogsState = {
  logs: [],
  loading: false,
  errorKey: null,
  loaded: false,
};

function remoteLogsKey(configId: string, spentOn: string, workPackageIds: string[]): string {
  return `${configId}:${spentOn}:${[...workPackageIds].sort().join(',')}`;
}

/**
 * Config-keyed same-day remote time-log loader with per-issue filtering.
 */
export function useRemoteDayLogs(date: Ref<string>) {
  const remoteLogsByConfig = ref<Record<string, RemoteDayLogsState>>({});
  const clientByConfigId = new Map<string, ReturnType<typeof useRemoteSyncClient>>();

  function clientFor(config: RemoteSystemConfigDto) {
    let client = clientByConfigId.get(config.id);
    if (!client) {
      client = useRemoteSyncClient(config);
      clientByConfigId.set(config.id, client);
    }
    return client;
  }

  async function ensureLoaded(
    config: RemoteSystemConfigDto,
    workPackageIds: string[],
    force = false,
  ): Promise<void> {
    const key = remoteLogsKey(config.id, date.value, workPackageIds);
    if (!force && remoteLogsByConfig.value[key]?.loaded) return;
    remoteLogsByConfig.value = {
      ...remoteLogsByConfig.value,
      [key]: { logs: [], loading: true, errorKey: null, loaded: false },
    };
    try {
      const logs = await clientFor(config).fetchTimeLogs({
        spentOn: date.value,
        workPackageIds,
      });
      remoteLogsByConfig.value = {
        ...remoteLogsByConfig.value,
        [key]: { logs, loading: false, errorKey: null, loaded: true },
      };
    } catch (err: unknown) {
      remoteLogsByConfig.value = {
        ...remoteLogsByConfig.value,
        [key]: {
          logs: [],
          loading: false,
          errorKey: mapRemoteSyncClientError(err, 'error.remoteTimeLogsFetchFailed'),
          loaded: true,
        },
      };
    }
  }

  async function retry(config: RemoteSystemConfigDto, workPackageIds: string[]): Promise<void> {
    clientFor(config).invalidateCaches();
    await ensureLoaded(config, workPackageIds, true);
  }

  function logsFor(
    configId: string | null | undefined,
    remoteIssueId: string | null | undefined,
  ): RemoteDayLogsState {
    if (!configId || !remoteIssueId) return EMPTY_LOGS_STATE;

    const matchingKeys = Object.keys(remoteLogsByConfig.value).filter((key) =>
      key.startsWith(`${configId}:${date.value}:`),
    );
    const states = matchingKeys.map((key) => remoteLogsByConfig.value[key]!);
    if (states.some((state) => state.loading)) {
      return { logs: [], loading: true, errorKey: null, loaded: false };
    }
    const errorState = states.find((state) => state.errorKey);
    if (errorState) {
      return {
        logs: [],
        loading: false,
        errorKey: errorState.errorKey,
        loaded: true,
      };
    }
    const logs = states
      .flatMap((state) => state.logs)
      .filter((log) => log.remoteIssueId === remoteIssueId);
    return { logs, loading: false, errorKey: null, loaded: states.length > 0 };
  }

  return {
    ensureLoaded,
    retry,
    logsFor,
    clientFor,
    remoteLogsByConfig,
  };
}
