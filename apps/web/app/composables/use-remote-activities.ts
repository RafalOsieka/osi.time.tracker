import { ref } from 'vue';
import { createRemoteAdapter } from '../utils/remote/create-remote-adapter';
import type { RemoteFieldOption, TrackerSystemType } from '@osi/remote-trackers/contracts';
import { resolveActivityScope } from '@osi/remote-trackers/contracts';
import type { TrackerDto } from '../../shared/types/tracker';
import { extractCaughtMessageKey } from '../utils/extract-message-key';
import { useTrackerSecret } from './use-tracker-secret';

export interface RemoteActivitiesState {
  options: RemoteFieldOption[];
  loading: boolean;
  errorKey: string | null;
  loaded: boolean;
}

/** The slice of a tracker config needed to resolve an activity scope. */
export interface ActivityScopeConfig {
  id: string;
  systemType: TrackerSystemType;
}

const EMPTY_ACTIVITIES_STATE: RemoteActivitiesState = {
  options: [],
  loading: false,
  errorKey: null,
  loaded: false,
};

function scopeKeyFor(config: ActivityScopeConfig, remoteIssueId: string): string {
  return `${config.id}:${resolveActivityScope(config.systemType, remoteIssueId)}`;
}

/**
 * Scope-keyed remote activity options loader. The cache key is
 * `configId:<provider-defined scope>` (REQ-332): a tracker whose activities
 * are a global enumeration (Redmine) shares one entry across every issue, and
 * one whose activities depend on the work package (OpenProject) keeps a
 * distinct entry per issue. Owns cache, in-flight dedupe, ensureLoaded/retry,
 * and selectors.
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
    const scopeKey = scopeKeyFor(config, remoteIssueId);
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

  function stateFor(
    config: ActivityScopeConfig | null | undefined,
    remoteIssueId: string | null | undefined,
  ) {
    if (!config || !remoteIssueId) return EMPTY_ACTIVITIES_STATE;
    return activitiesByScopeKey.value[scopeKeyFor(config, remoteIssueId)] ?? EMPTY_ACTIVITIES_STATE;
  }

  return {
    ensureLoaded,
    retry,
    stateFor,
    activitiesByScopeKey,
  };
}
