import type { RemoteProjectDto, RemoteTimeLogDto } from '@osi/remote-trackers/contracts';

/** The minimal Project shape routing needs: identity plus its remote scope, if any. */
export interface ScopedProjectLike {
  id: string;
  remoteProjectId: string | null;
}

export interface RouteLogsByScopeGroup {
  projectId: string;
  logs: RemoteTimeLogDto[];
}

/**
 * All of one remote project's logs from a scan, plus the scope-derived
 * default target Project (REQ-334) — `null` when no scope covers it. This is
 * only the mapping phase's starting suggestion (REQ-358): the final target is
 * whatever the user selects, independent of `defaultProjectId`.
 */
export interface RemoteProjectBucket {
  /** `null` when the log carried no remote project id at all (REQ-334). */
  remoteProjectId: string | null;
  remoteProjectTitle: string | null;
  logs: RemoteTimeLogDto[];
  defaultProjectId: string | null;
}

/** The map key a bucket or a mapping selection is keyed by: the remote project id, or `''` when it has none. */
export function bucketKey(remoteProjectId: string | null): string {
  return remoteProjectId ?? '';
}

/**
 * Buckets fetched remote logs by remote project (REQ-358): every remote
 * project id encountered in `logs` gets exactly one bucket, including `null`
 * for logs with no remote project id at all. Each bucket also carries a
 * default target Project (REQ-334): the nearest scoped ancestor of the
 * remote project, walking parent links from the log's project upward — the
 * first match wins, so a scope on a descendant takes precedence over one on
 * its ancestor. A bucket whose walk reaches the root without a match, or
 * whose remote project id is absent from the catalog, gets `defaultProjectId:
 * null`. Pure and synchronous: no network calls.
 */
export function routeLogsByScope(
  logs: RemoteTimeLogDto[],
  catalog: RemoteProjectDto[],
  projects: ScopedProjectLike[],
): RemoteProjectBucket[] {
  const parentById = new Map(catalog.map((entry) => [entry.remoteProjectId, entry.parentId]));
  const titleById = new Map(catalog.map((entry) => [entry.remoteProjectId, entry.title]));
  const scopedProjectByRemoteId = new Map(
    projects
      .filter((project): project is ScopedProjectLike & { remoteProjectId: string } =>
        Boolean(project.remoteProjectId),
      )
      .map((project) => [project.remoteProjectId, project.id]),
  );

  function defaultProjectFor(remoteProjectId: string): string | null {
    let current: string | undefined = remoteProjectId;
    // Bound the walk by the catalog size so a malformed cyclic parent chain
    // cannot loop forever.
    for (let steps = 0; current != null && steps <= catalog.length; steps += 1) {
      const owner = scopedProjectByRemoteId.get(current);
      if (owner) return owner;
      if (!parentById.has(current)) {
        // The project itself is absent from the catalog (or we've walked off
        // the top): nothing further to check.
        return null;
      }
      current = parentById.get(current);
    }
    return null;
  }

  const byKey = new Map<string, RemoteProjectBucket>();

  for (const log of logs) {
    const remoteProjectId = log.remoteProjectId ?? null;
    const key = bucketKey(remoteProjectId);
    const existing = byKey.get(key);
    if (existing) {
      existing.logs.push(log);
      continue;
    }
    const remoteProjectTitle =
      (remoteProjectId ? titleById.get(remoteProjectId) : undefined) ??
      log.remoteProjectTitle ??
      null;
    byKey.set(key, {
      remoteProjectId,
      remoteProjectTitle,
      logs: [log],
      defaultProjectId: remoteProjectId ? defaultProjectFor(remoteProjectId) : null,
    });
  }

  return [...byKey.values()];
}

/**
 * Re-groups buckets by the caller's target selection (REQ-358), merging
 * buckets assigned the same Project and dropping any bucket left unassigned
 * (`selection` missing the key, or explicitly `null`). Pure and synchronous.
 */
export function groupLogsBySelection(
  buckets: RemoteProjectBucket[],
  selection: Map<string, string | null>,
): RouteLogsByScopeGroup[] {
  const logsByProjectId = new Map<string, RemoteTimeLogDto[]>();
  for (const bucket of buckets) {
    const target = selection.get(bucketKey(bucket.remoteProjectId)) ?? null;
    if (!target) continue;
    const existing = logsByProjectId.get(target);
    if (existing) {
      existing.push(...bucket.logs);
    } else {
      logsByProjectId.set(target, [...bucket.logs]);
    }
  }
  return [...logsByProjectId.entries()].map(([projectId, groupLogs]) => ({
    projectId,
    logs: groupLogs,
  }));
}
