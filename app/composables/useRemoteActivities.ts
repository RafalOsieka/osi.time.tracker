import { createRemoteAdapter } from '../utils/remote/create-remote-adapter';
import type { RemoteFieldOption } from '../../shared/types/remote-field-option';
import type { TrackerDto } from '../../shared/types/tracker';

export interface RemoteActivitiesState {
  options: RemoteFieldOption[];
  loading: boolean;
  errorKey: string | null;
  loaded: boolean;
}

const EMPTY_ACTIVITIES_STATE: RemoteActivitiesState = {
  options: [],
  loading: false,
  errorKey: null,
  loaded: false,
};

function scopeKeyFor(configId: string, remoteIssueId: string): string {
  return `${configId}:${remoteIssueId}`;
}

/**
 * Scope-keyed remote activity options loader (configId + remoteIssueId).
 * Owns cache, in-flight dedupe, ensureLoaded/retry, and selectors.
 */
export function useRemoteActivities() {
  const { get: getSecret } = useTrackerSecret();
  const activitiesByScopeKey = ref<Record<string, RemoteActivitiesState>>({});
  const activitiesInFlight = new Map<string, Promise<void>>();

  async function ensureLoaded(
    config: TrackerDto,
    remoteIssueId: string,
    force = false,
  ): Promise<void> {
    const scopeKey = scopeKeyFor(config.id, remoteIssueId);
    if (!force && activitiesByScopeKey.value[scopeKey]?.loaded) return;
    if (!force) {
      const inflight = activitiesInFlight.get(scopeKey);
      if (inflight) {
        await inflight;
        return;
      }
    }

    const run = (async () => {
      activitiesByScopeKey.value = {
        ...activitiesByScopeKey.value,
        [scopeKey]: { options: [], loading: true, errorKey: null, loaded: false },
      };

      const secret = getSecret(config.id);
      const adapter = createRemoteAdapter(config, secret);
      try {
        const options = await adapter.getActivityOptions(remoteIssueId);
        activitiesByScopeKey.value = {
          ...activitiesByScopeKey.value,
          [scopeKey]: {
            options,
            loading: false,
            errorKey: null,
            loaded: true,
          },
        };
      } catch (err) {
        activitiesByScopeKey.value = {
          ...activitiesByScopeKey.value,
          [scopeKey]: {
            options: [],
            loading: false,
            errorKey: extractCaughtMessageKey(err, 'error.remoteActivitiesFetchFailed'),
            loaded: true,
          },
        };
      }
    })();

    activitiesInFlight.set(scopeKey, run);
    try {
      await run;
    } finally {
      activitiesInFlight.delete(scopeKey);
    }
  }

  async function retry(config: TrackerDto, remoteIssueId: string): Promise<void> {
    await ensureLoaded(config, remoteIssueId, true);
  }

  function stateFor(configId: string | null | undefined, remoteIssueId: string | null | undefined) {
    if (!configId || !remoteIssueId) return EMPTY_ACTIVITIES_STATE;
    return (
      activitiesByScopeKey.value[scopeKeyFor(configId, remoteIssueId)] ?? EMPTY_ACTIVITIES_STATE
    );
  }

  return {
    ensureLoaded,
    retry,
    stateFor,
    activitiesByScopeKey,
  };
}
