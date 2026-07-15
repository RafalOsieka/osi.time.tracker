import { ref } from 'vue';
import {
  buildTimeEntryActivitiesRequest,
  parseTimeEntryActivitiesResults,
} from '../../shared/utils/openproject-adapter';
import type { AdapterFieldOption } from '../../shared/utils/openproject-adapter';
import { REMOTE_PROXY_SECRET_HEADER } from '../../shared/config/remote-proxy';
import { extractMessageKey } from '../utils/extractMessageKey';
import type {
  ProxiedRemoteActivitiesDto,
  ProxiedRemoteActivitiesResponseDto,
} from '../../shared/types/remote-activities';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';
import { useRemoteConfigSecret } from './useRemoteConfigSecret';

/**
 * Fetches the OpenProject time-entry activity options for a given remote
 * configuration (REQ-TTR-117), once per config, via the same
 * direct/proxied transport selection as `useRemoteIssueSearch`.
 */
export function useRemoteActivities(config: RemoteSystemConfigDto) {
  const { get: getSecret } = useRemoteConfigSecret();

  const options = ref<AdapterFieldOption[]>([]);
  const loading = ref(false);
  const errorKey = ref<string | null>(null);

  async function fetchOptions(): Promise<void> {
    loading.value = true;
    errorKey.value = null;

    const secret = getSecret(config.id);

    try {
      options.value =
        config.transportMode === 'proxied' ? await fetchProxied(secret) : await fetchDirect(secret);
    } catch (err: unknown) {
      options.value = [];
      errorKey.value = extractMessageKey(err, 'error.remoteActivitiesFetchFailed');
    } finally {
      loading.value = false;
    }
  }

  async function fetchDirect(secret: string | null): Promise<AdapterFieldOption[]> {
    const request = buildTimeEntryActivitiesRequest(config.baseUrl);
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        ...(secret ? { Authorization: `Basic ${encodeBasicAuth(secret)}` } : {}),
      },
    });
    if (!response.ok) {
      throw toDirectTransportError('error.remoteActivitiesFetchFailed');
    }
    const payload = await response.json();
    return parseTimeEntryActivitiesResults(payload);
  }

  async function fetchProxied(secret: string | null): Promise<AdapterFieldOption[]> {
    if (!secret) {
      throw toDirectTransportError('error.remoteProxySecretRequired');
    }

    const { $csrfFetch } = useNuxtApp();
    const body: ProxiedRemoteActivitiesDto = { remoteSystemConfigId: config.id };
    const response = await $csrfFetch<ProxiedRemoteActivitiesResponseDto>(
      '/api/remote/activities',
      {
        method: 'POST',
        headers: { [REMOTE_PROXY_SECRET_HEADER]: secret },
        body,
      },
    );

    return response.options;
  }

  return { fetchOptions, options, loading, errorKey };
}

/**
 * Wraps a local (non-`$fetch`) failure in the same `data.data.messageKey`
 * shape `extractMessageKey` expects from a Nitro `createError` response.
 */
function toDirectTransportError(messageKey: string): { data: { data: { messageKey: string } } } {
  return { data: { data: { messageKey } } };
}

/**
 * Builds the OpenProject Basic-auth token: username `apikey`, password the
 * stored API key, per OpenProject's REST API v3 convention.
 */
function encodeBasicAuth(apiKey: string): string {
  const raw = `apikey:${apiKey}`;
  if (typeof btoa === 'function') {
    return btoa(raw);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Node fallback (SSR/test) has no `btoa` global on older runtimes.
  return (globalThis as any).Buffer.from(raw, 'utf-8').toString('base64');
}
