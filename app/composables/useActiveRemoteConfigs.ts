import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';

/**
 * Loads and caches each Client's active `RemoteSystemConfigDto` (if any),
 * keyed by Client id. Shared across the Timer view so every Task row can
 * resolve its Project -> Client -> active-config chain without issuing a
 * duplicate network request per row.
 */
export function useActiveRemoteConfigs() {
  const configs = useState<Record<string, RemoteSystemConfigDto | null>>(
    'active-remote-configs',
    () => ({}),
  );
  const pending = new Set<string>();

  async function ensureLoaded(clientId: string): Promise<void> {
    if (clientId in configs.value || pending.has(clientId)) return;
    pending.add(clientId);
    try {
      const config = await $fetch<RemoteSystemConfigDto>(`/api/clients/${clientId}/remote-config`);
      configs.value = { ...configs.value, [clientId]: config };
    } catch {
      configs.value = { ...configs.value, [clientId]: null };
    } finally {
      pending.delete(clientId);
    }
  }

  function getConfig(clientId: string | null | undefined): RemoteSystemConfigDto | null {
    if (!clientId) return null;
    return configs.value[clientId] ?? null;
  }

  return { configs, ensureLoaded, getConfig };
}
