import { ref } from 'vue';
import {
  buildCreateTimeEntryRequest,
  buildCurrentAccountRequest,
  buildTimeLogsRequest,
  parseCreateTimeEntryResult,
  parseCurrentAccountResult,
  parseTimeLogsPage,
  type OpenProjectAccount,
} from '../../shared/utils/openproject-adapter';
import { REMOTE_PROXY_SECRET_HEADER } from '../../shared/config/remote-proxy';
import { extractMessageKey } from '../utils/extractMessageKey';
import type {
  ProxiedRemoteAccountDto,
  ProxiedRemoteAccountResponseDto,
  ProxiedRemoteCreateTimeEntryDto,
  ProxiedRemoteCreateTimeEntryResponseDto,
  ProxiedRemoteTimeLogsDto,
  ProxiedRemoteTimeLogsResponseDto,
  RemoteTimeLogDto,
} from '../../shared/types/remote-export';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';
import { useRemoteConfigSecret } from './useRemoteConfigSecret';

/**
 * Transport-agnostic OpenProject client operations used by browser-orchestrated
 * remote sync: current account, paginated same-day logs, and time-entry create.
 * Direct and proxied modes share builders/parsers and request deduplication.
 */
export function useOpenProjectClient(config: RemoteSystemConfigDto) {
  const { get: getSecret } = useRemoteConfigSecret();

  const accountCache = ref<OpenProjectAccount | null>(null);
  const logsCache = new Map<string, RemoteTimeLogDto[]>();
  const inFlightLogs = new Map<string, Promise<RemoteTimeLogDto[]>>();
  let accountInFlight: Promise<OpenProjectAccount> | null = null;

  async function resolveAccount(): Promise<OpenProjectAccount> {
    if (accountCache.value) return accountCache.value;
    if (accountInFlight) return accountInFlight;

    accountInFlight = (async () => {
      const secret = getSecret(config.id);
      const account =
        config.transportMode === 'proxied'
          ? await resolveAccountProxied(secret)
          : await resolveAccountDirect(secret);
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
      const secret = getSecret(config.id);
      const logs =
        config.transportMode === 'proxied'
          ? await fetchTimeLogsProxied(secret, {
              spentOn: input.spentOn,
              workPackageIds: input.workPackageIds,
              userId: account.id,
            })
          : await fetchTimeLogsDirect(secret, {
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
    const secret = getSecret(config.id);
    if (config.transportMode === 'proxied') {
      return createTimeEntryProxied(secret, input);
    }
    return createTimeEntryDirect(secret, input);
  }

  function invalidateCaches(): void {
    accountCache.value = null;
    logsCache.clear();
  }

  async function resolveAccountDirect(secret: string | null): Promise<OpenProjectAccount> {
    const request = buildCurrentAccountRequest(config.baseUrl);
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        ...(secret ? { Authorization: `Basic ${encodeBasicAuth(secret)}` } : {}),
      },
    });
    if (!response.ok) throw toDirectTransportError('error.remoteAccountFetchFailed');
    const account = parseCurrentAccountResult(await response.json());
    if (!account) throw toDirectTransportError('error.remoteAccountFetchFailed');
    return account;
  }

  async function resolveAccountProxied(secret: string | null): Promise<OpenProjectAccount> {
    if (!secret) throw toDirectTransportError('error.remoteProxySecretRequired');
    const { $csrfFetch } = useNuxtApp();
    const body: ProxiedRemoteAccountDto = { remoteSystemConfigId: config.id };
    const response = await $csrfFetch<ProxiedRemoteAccountResponseDto>('/api/remote/account', {
      method: 'POST',
      headers: { [REMOTE_PROXY_SECRET_HEADER]: secret },
      body,
    });
    return response;
  }

  async function fetchTimeLogsDirect(
    secret: string | null,
    input: { spentOn: string; workPackageIds: string[]; userId: string },
  ): Promise<RemoteTimeLogDto[]> {
    const logs: RemoteTimeLogDto[] = [];
    let nextPageUrl: string | undefined;
    for (let page = 0; page < 50; page += 1) {
      const request = buildTimeLogsRequest({
        baseUrl: config.baseUrl,
        spentOn: input.spentOn,
        workPackageIds: input.workPackageIds,
        userId: input.userId,
        nextPageUrl,
      });
      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          Accept: 'application/json',
          ...(secret ? { Authorization: `Basic ${encodeBasicAuth(secret)}` } : {}),
        },
      });
      if (!response.ok) throw toDirectTransportError('error.remoteTimeLogsFetchFailed');
      const parsed = parseTimeLogsPage(await response.json());
      logs.push(...parsed.logs);
      if (!parsed.nextPageUrl) break;
      nextPageUrl = parsed.nextPageUrl;
    }
    return logs;
  }

  async function fetchTimeLogsProxied(
    secret: string | null,
    input: { spentOn: string; workPackageIds: string[]; userId: string },
  ): Promise<RemoteTimeLogDto[]> {
    if (!secret) throw toDirectTransportError('error.remoteProxySecretRequired');
    const { $csrfFetch } = useNuxtApp();
    const body: ProxiedRemoteTimeLogsDto = {
      remoteSystemConfigId: config.id,
      spentOn: input.spentOn,
      workPackageIds: input.workPackageIds,
      userId: input.userId,
    };
    const response = await $csrfFetch<ProxiedRemoteTimeLogsResponseDto>('/api/remote/time-logs', {
      method: 'POST',
      headers: { [REMOTE_PROXY_SECRET_HEADER]: secret },
      body,
    });
    return response.logs;
  }

  async function createTimeEntryDirect(
    secret: string | null,
    input: {
      remoteIssueId: string;
      spentOn: string;
      durationSeconds: number;
      activityId: string;
      comment?: string;
    },
  ): Promise<{ remoteLogId: string }> {
    const request = buildCreateTimeEntryRequest({
      baseUrl: config.baseUrl,
      ...input,
    });
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Basic ${encodeBasicAuth(secret)}` } : {}),
      },
      body: JSON.stringify(request.body),
    });
    if (!response.ok) throw toDirectTransportError('error.remoteExportCreateFailed');
    const created = parseCreateTimeEntryResult(await response.json());
    if (!created) throw toDirectTransportError('error.remoteExportCreateFailed');
    return created;
  }

  async function createTimeEntryProxied(
    secret: string | null,
    input: {
      remoteIssueId: string;
      spentOn: string;
      durationSeconds: number;
      activityId: string;
      comment?: string;
    },
  ): Promise<{ remoteLogId: string }> {
    if (!secret) throw toDirectTransportError('error.remoteProxySecretRequired');
    const { $csrfFetch } = useNuxtApp();
    const body: ProxiedRemoteCreateTimeEntryDto = {
      remoteSystemConfigId: config.id,
      ...input,
    };
    const response = await $csrfFetch<ProxiedRemoteCreateTimeEntryResponseDto>(
      '/api/remote/time-entries',
      {
        method: 'POST',
        headers: { [REMOTE_PROXY_SECRET_HEADER]: secret },
        body,
      },
    );
    return response;
  }

  return {
    resolveAccount,
    fetchTimeLogs,
    createTimeEntry,
    invalidateCaches,
  };
}

function toDirectTransportError(messageKey: string): { data: { data: { messageKey: string } } } {
  return { data: { data: { messageKey } } };
}

function encodeBasicAuth(apiKey: string): string {
  const raw = `apikey:${apiKey}`;
  if (typeof btoa === 'function') {
    return btoa(raw);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Node fallback (SSR/test) has no `btoa` global on older runtimes.
  return (globalThis as any).Buffer.from(raw, 'utf-8').toString('base64');
}

// Re-export extractMessageKey usage helper for callers mapping failures.
export function mapOpenProjectClientError(err: unknown, fallback: string): string {
  return extractMessageKey(err, fallback);
}
