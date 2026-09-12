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

/** Logs that matched no scoped Project, bucketed by the remote project they belong to. */
export interface UnmatchedRemoteProjectBucket {
  /** `null` when the log carried no remote project id at all (REQ-334). */
  remoteProjectId: string | null;
  remoteProjectTitle: string | null;
  logs: RemoteTimeLogDto[];
}

export interface RouteLogsByScopeResult {
  matched: RouteLogsByScopeGroup[];
  unmatched: UnmatchedRemoteProjectBucket[];
}

/**
 * Routes fetched remote logs to local Projects by remote-project scope
 * (REQ-334): walks each log's remote project up through the catalog's parent
 * links until it finds a Project scoped to that id (the nearest scoped
 * ancestor wins, so a scope on a descendant takes precedence over one on its
 * ancestor). A log whose walk reaches the root without a match, whose remote
 * project id is absent from the catalog, or that carries no remote project id
 * at all is reported unmatched, grouped by its own remote project. Pure and
 * synchronous: no network calls.
 */
export function routeLogsByScope(
  logs: RemoteTimeLogDto[],
  catalog: RemoteProjectDto[],
  projects: ScopedProjectLike[],
): RouteLogsByScopeResult {
  const parentById = new Map(catalog.map((entry) => [entry.remoteProjectId, entry.parentId]));
  const titleById = new Map(catalog.map((entry) => [entry.remoteProjectId, entry.title]));
  const scopedProjectByRemoteId = new Map(
    projects
      .filter((project): project is ScopedProjectLike & { remoteProjectId: string } =>
        Boolean(project.remoteProjectId),
      )
      .map((project) => [project.remoteProjectId, project.id]),
  );

  const matchedByProjectId = new Map<string, RemoteTimeLogDto[]>();
  const unmatchedByKey = new Map<string, UnmatchedRemoteProjectBucket>();

  function addUnmatched(log: RemoteTimeLogDto, remoteProjectId: string | null): void {
    const key = remoteProjectId ?? '';
    const existing = unmatchedByKey.get(key);
    if (existing) {
      existing.logs.push(log);
      return;
    }
    const remoteProjectTitle =
      (remoteProjectId ? titleById.get(remoteProjectId) : undefined) ??
      log.remoteProjectTitle ??
      null;
    unmatchedByKey.set(key, { remoteProjectId, remoteProjectTitle, logs: [log] });
  }

  for (const log of logs) {
    const leafId = log.remoteProjectId ?? null;
    if (!leafId) {
      addUnmatched(log, null);
      continue;
    }

    let current: string | undefined = leafId;
    let matchedProjectId: string | undefined;
    // Bound the walk by the catalog size so a malformed cyclic parent chain
    // cannot loop forever.
    for (let steps = 0; current != null && steps <= catalog.length; steps += 1) {
      const owner = scopedProjectByRemoteId.get(current);
      if (owner) {
        matchedProjectId = owner;
        break;
      }
      if (!parentById.has(current)) {
        // The project itself is absent from the catalog (or we've walked off
        // the top): nothing further to check.
        break;
      }
      current = parentById.get(current);
    }

    if (matchedProjectId) {
      const bucket = matchedByProjectId.get(matchedProjectId) ?? [];
      bucket.push(log);
      matchedByProjectId.set(matchedProjectId, bucket);
    } else {
      addUnmatched(log, leafId);
    }
  }

  return {
    matched: [...matchedByProjectId.entries()].map(([projectId, matchedLogs]) => ({
      projectId,
      logs: matchedLogs,
    })),
    unmatched: [...unmatchedByKey.values()],
  };
}
