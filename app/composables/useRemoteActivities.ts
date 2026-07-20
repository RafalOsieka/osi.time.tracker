import { ref } from 'vue';
import { createRemoteAdapter } from '../utils/remote/create-remote-adapter';
import { extractRemoteErrorKey } from '../utils/remote/extract-remote-error-key';
import type { RemoteFieldOption } from '../../shared/types/remote-field-option';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';
import { useRemoteConfigSecret } from './useRemoteConfigSecret';

/**
 * Fetches the time-entry activity options for a given remote configuration,
 * project-scoped by the linked work package `remoteIssueId` (REQ-TTR-117),
 * via the `RemoteTrackerAdapter` selected for `config.executionMode`. The
 * 403 -> empty-options quirk is handled once, inside the adapter.
 */
export function useRemoteActivities(config: RemoteSystemConfigDto) {
  const { get: getSecret } = useRemoteConfigSecret();

  const options = ref<RemoteFieldOption[]>([]);
  const loading = ref(false);
  const errorKey = ref<string | null>(null);

  async function fetchOptions(remoteIssueId: string): Promise<void> {
    loading.value = true;
    errorKey.value = null;

    const secret = getSecret(config.id);
    const adapter = createRemoteAdapter(config, secret);

    try {
      options.value = await adapter.getActivityOptions(remoteIssueId);
    } catch (err: unknown) {
      options.value = [];
      errorKey.value = extractRemoteErrorKey(err, 'error.remoteActivitiesFetchFailed');
    } finally {
      loading.value = false;
    }
  }

  return { fetchOptions, options, loading, errorKey };
}
