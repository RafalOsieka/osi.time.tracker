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
 * configuration, project-scoped by the linked work package `remoteIssueId`
 * (REQ-TTR-117), via the same direct/proxied transport selection as
 * `useRemoteIssueSearch`.
 */
export function useRemoteActivities(config: RemoteSystemConfigDto) {
  const { get: getSecret } = useRemoteConfigSecret();

  const options = ref<AdapterFieldOption[]>([]);
  const loading = ref(false);
  const errorKey = ref<string | null>(null);

  async function fetchOptions(remoteIssueId: string): Promise<void> {
    loading.value = true;
    errorKey.value = null;

    const secret = getSecret(config.id);

    try {
      options.value =
        config.transportMode === 'proxied'
          ? await fetchProxied(secret, remoteIssueId)
          : await fetchDirect(secret, remoteIssueId);
    } catch (err: unknown) {
      options.value = [];
      errorKey.value = extractMessageKey(err, 'error.remoteActivitiesFetchFailed');
    } finally {
      loading.value = false;
    }
  }

  async function fetchDirect(
    secret: string | null,
    remoteIssueId: string,
  ): Promise<AdapterFieldOption[]> {
    const request = buildTimeEntryActivitiesRequest(config.baseUrl, remoteIssueId);
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Basic ${encodeBasicAuth(secret)}` } : {}),
      },
      body: JSON.stringify(request.body),
    });
    if (response.status === 403) {
      // OpenProject returns 403 for work packages whose type doesn't allow
      // time logging (e.g. a "Summary" item) — a per-work-package
      // permission outcome, not a rejected credential, so treat it as an
      // empty result rather than a hard failure.
      return [];
    }
    if (!response.ok) {
      throw toDirectTransportError('error.remoteActivitiesFetchFailed');
    }
    const payload = await response.json();
    return parseTimeEntryActivitiesResults(payload);
  }

  async function fetchProxied(
    secret: string | null,
    remoteIssueId: string,
  ): Promise<AdapterFieldOption[]> {
    if (!secret) {
      throw toDirectTransportError('error.remoteProxySecretRequired');
    }

    const { $csrfFetch } = useNuxtApp();
    const body: ProxiedRemoteActivitiesDto = { remoteSystemConfigId: config.id, remoteIssueId };
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
