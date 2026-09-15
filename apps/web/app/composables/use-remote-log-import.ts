import { computed, ref } from 'vue';
import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import type { TrackerDto } from '../../shared/types/tracker';
import type { ProjectDto } from '../../shared/types/project';
import type {
  ImportRemoteLogsDto,
  ImportRemoteLogsResultDto,
} from '../../shared/types/remote-log-import';
import { createRemoteAdapter } from '../utils/remote/create-remote-adapter';
import { extractCaughtMessageKey } from '../utils/extract-message-key';
import {
  bucketKey,
  groupLogsBySelection,
  routeLogsByScope,
  type RemoteProjectBucket,
  type RouteLogsByScopeGroup,
  type ScopedProjectLike,
} from '../utils/remote/route-logs-by-scope';
import {
  splitGroupsIntoRequestBatches,
  splitIntoMonthChunks,
  type DateRange,
} from '../utils/month-range';
import { mapRemoteSyncClientError, useRemoteSyncClient } from './use-remote-sync-client';
import { useTrackerSecret } from './use-tracker-secret';

export type ImportPhase =
  | 'range'
  | 'scanning'
  | 'mapping'
  | 'preview'
  | 'importing'
  | 'done'
  | 'error';

export interface ImportProjectPreview {
  projectId: string;
  wouldImport: number;
  skippedExisting: number;
  /** Distinct remote project titles (or ids, when a title is unavailable) routed into this Project. */
  remoteProjectTitles: string[];
}

/** One remote project encountered during the scan, with its editable target selection (REQ-358). */
export interface MappingRow {
  /** `null` for logs carrying no remote project id at all (REQ-334). */
  remoteProjectId: string | null;
  remoteProjectTitle: string | null;
  /** Total logs for this remote project across the whole scanned range. */
  logCount: number;
  /** The scope-based suggestion (REQ-334) this row's selection starts from. */
  defaultProjectId: string | null;
}

export interface ImportPreview {
  matched: ImportProjectPreview[];
  /** Logs left unassigned in the mapping phase, excluded from import (REQ-358). */
  unassignedCount: number;
}

export interface ImportRunResult {
  totalImported: number;
  totalSkippedExisting: number;
  totalUnmatched: number;
}

export interface ImportErrorState {
  messageKey: string;
  monthsCompleted: number;
  totalMonths: number;
  stage: 'scan' | 'mapping' | 'import';
}

/** Aggregates each month's routing buckets into one row per remote project across the whole range (REQ-358). */
function buildMappingRows(bucketsByMonth: RemoteProjectBucket[][]): MappingRow[] {
  const byKey = new Map<string, MappingRow>();
  for (const buckets of bucketsByMonth) {
    for (const bucket of buckets) {
      const key = bucketKey(bucket.remoteProjectId);
      const existing = byKey.get(key);
      if (existing) {
        existing.logCount += bucket.logs.length;
        continue;
      }
      byKey.set(key, {
        remoteProjectId: bucket.remoteProjectId,
        remoteProjectTitle: bucket.remoteProjectTitle,
        logCount: bucket.logs.length,
        defaultProjectId: bucket.defaultProjectId,
      });
    }
  }
  return [...byKey.values()];
}

/**
 * Phase state machine for tracker-level remote-log import (REQ-334/REQ-340/
 * REQ-358): scans a date range month by month (catalog + range fetch,
 * bucketed by remote project with a scope-based default target), lets the
 * user confirm or override each remote project's target in the mapping
 * phase, then runs the dry run once against the finalized selection to build
 * the preview, and imports month by month on confirm. Both the preview and
 * the write reuse the same idempotent endpoint, so a failed month can simply
 * be retried — already-imported logs are skipped server-side (REQ-338).
 */
export function useRemoteLogImport(options: {
  config: TrackerDto;
  /** The tracker's own non-deleted Projects (scoped or not). */
  projects: ProjectDto[];
  importLogs: (body: ImportRemoteLogsDto) => Promise<ImportRemoteLogsResultDto>;
}) {
  const { get: getSecret } = useTrackerSecret();
  const syncClient = useRemoteSyncClient(options.config);

  const phase = ref<ImportPhase>('range');
  const scannedMonths = ref(0);
  const importedMonths = ref(0);
  const totalMonths = ref(0);
  const mappingRows = ref<MappingRow[]>([]);
  const selection = ref<Map<string, string | null>>(new Map());
  const preview = ref<ImportPreview>({ matched: [], unassignedCount: 0 });
  const missingProjectIdHint = ref(false);
  const result = ref<ImportRunResult | null>(null);
  const errorState = ref<ImportErrorState | null>(null);

  let lastRange: DateRange | null = null;
  let cancelRequested = false;
  // Raw routing buckets per scanned month, kept so the mapping phase can be
  // revisited and the dry run re-run without re-fetching (REQ-358).
  let bucketsByMonth: RemoteProjectBucket[][] = [];
  // Final per-month groups, built by advanceToPreview() from the current
  // selection, that startImport() replays unchanged.
  let routedByMonth: RouteLogsByScopeGroup[][] = [];

  const hasNothingToImport = computed(() =>
    preview.value.matched.every((project) => project.wouldImport === 0),
  );

  function scopedProjects(): ScopedProjectLike[] {
    return options.projects.map((project) => ({
      id: project.id,
      remoteProjectId: project.remoteProjectId,
    }));
  }

  function projectPreviewSlot(
    target: Map<string, ImportProjectPreview>,
    projectId: string,
  ): ImportProjectPreview {
    const existing = target.get(projectId);
    if (existing) return existing;
    const created: ImportProjectPreview = {
      projectId,
      wouldImport: 0,
      skippedExisting: 0,
      remoteProjectTitles: [],
    };
    target.set(projectId, created);
    return created;
  }

  function mergeProjectPreview(
    target: Map<string, ImportProjectPreview>,
    result: ImportRemoteLogsResultDto,
  ): void {
    for (const row of result.projects) {
      const slot = projectPreviewSlot(target, row.projectId);
      slot.wouldImport += row.wouldImport;
      slot.skippedExisting += row.skippedExisting;
    }
  }

  /**
   * Records which remote projects feed each Project's final group, straight
   * from `mappingRows`' catalog-resolved titles (REQ-334) and the current
   * selection — independent of the server's per-Project dry-run counts (the
   * write endpoint only reports totals per local Project, never per remote
   * project) and, unlike reading titles off individual logs, unaffected by
   * whether the tracker happened to echo a project title on each log.
   */
  function mergeRemoteProjectTitlesFromMapping(target: Map<string, ImportProjectPreview>): void {
    for (const row of mappingRows.value) {
      const targetProjectId = selection.value.get(bucketKey(row.remoteProjectId));
      if (!targetProjectId) continue;
      const slot = projectPreviewSlot(target, targetProjectId);
      const title = row.remoteProjectTitle ?? row.remoteProjectId;
      if (title && !slot.remoteProjectTitles.includes(title)) {
        slot.remoteProjectTitles.push(title);
      }
    }
  }

  /** Aborts an in-progress scan and returns to the range phase. No-op outside 'scanning'. */
  function cancelScan(): void {
    if (phase.value === 'scanning') cancelRequested = true;
  }

  async function startScan(range: DateRange): Promise<void> {
    lastRange = range;
    cancelRequested = false;
    phase.value = 'scanning';
    scannedMonths.value = 0;
    missingProjectIdHint.value = false;
    errorState.value = null;
    bucketsByMonth = [];

    const secret = getSecret(options.config.id);
    let catalog;
    try {
      catalog = await createRemoteAdapter(options.config, secret).listProjects();
    } catch (err) {
      errorState.value = {
        messageKey: extractCaughtMessageKey(err, 'error.remoteProjectsFetchFailed'),
        monthsCompleted: 0,
        totalMonths: 0,
        stage: 'scan',
      };
      phase.value = 'error';
      return;
    }

    const months = splitIntoMonthChunks(range.from, range.to);
    totalMonths.value = months.length;

    for (const month of months) {
      if (cancelRequested) {
        phase.value = 'range';
        return;
      }

      let logs: RemoteTimeLogDto[];
      try {
        logs = await syncClient.fetchTimeLogsInRange({ from: month.from, to: month.to });
      } catch (err) {
        errorState.value = {
          messageKey: mapRemoteSyncClientError(err, 'error.remoteTimeLogsFetchFailed'),
          monthsCompleted: scannedMonths.value,
          totalMonths: totalMonths.value,
          stage: 'scan',
        };
        phase.value = 'error';
        return;
      }

      if (logs.some((log) => !log.remoteProjectId)) missingProjectIdHint.value = true;

      bucketsByMonth.push(routeLogsByScope(logs, catalog, scopedProjects()));
      scannedMonths.value += 1;
    }

    mappingRows.value = buildMappingRows(bucketsByMonth);
    selection.value = new Map(
      mappingRows.value.map((row) => [bucketKey(row.remoteProjectId), row.defaultProjectId]),
    );
    phase.value = 'mapping';
  }

  /** Reads the current target selection for a remote project row (REQ-358). */
  function getMapping(remoteProjectId: string | null): string | null {
    return selection.value.get(bucketKey(remoteProjectId)) ?? null;
  }

  /** Overrides a remote project row's target Project. Pure state, no network call (REQ-358). */
  function setMapping(remoteProjectId: string | null, targetProjectId: string | null): void {
    selection.value.set(bucketKey(remoteProjectId), targetProjectId);
  }

  /**
   * Leaves the mapping phase: regroups every scanned month's buckets by the
   * current selection, runs the dry run once against the result, and builds
   * the preview (REQ-358). Safe to call again after the user goes back and
   * changes a selection — no re-fetch, just a fresh regroup + dry run.
   */
  async function advanceToPreview(): Promise<void> {
    errorState.value = null;
    routedByMonth = [];
    const matchedTotals = new Map<string, ImportProjectPreview>();
    const unassignedCount = mappingRows.value
      .filter((row) => !selection.value.get(bucketKey(row.remoteProjectId)))
      .reduce((sum, row) => sum + row.logCount, 0);
    mergeRemoteProjectTitlesFromMapping(matchedTotals);

    for (const buckets of bucketsByMonth) {
      const groups = groupLogsBySelection(buckets, selection.value);
      routedByMonth.push(groups);

      try {
        for (const batch of splitGroupsIntoRequestBatches(groups)) {
          const dryRunResult = await options.importLogs({ dryRun: true, groups: batch });
          mergeProjectPreview(matchedTotals, dryRunResult);
        }
      } catch (err) {
        errorState.value = {
          messageKey: extractCaughtMessageKey(err, 'error.unknown'),
          monthsCompleted: 0,
          totalMonths: totalMonths.value,
          stage: 'mapping',
        };
        phase.value = 'error';
        return;
      }
    }

    preview.value = {
      matched: [...matchedTotals.values()].map((project) => ({
        ...project,
        remoteProjectTitles: [...project.remoteProjectTitles].sort(),
      })),
      unassignedCount,
    };
    phase.value = 'preview';
  }

  /** Returns to the mapping phase without discarding the scan or the current selection. */
  function backToMapping(): void {
    phase.value = 'mapping';
  }

  async function startImport(): Promise<void> {
    phase.value = 'importing';
    importedMonths.value = 0;
    let totalImported = 0;
    let totalSkippedExisting = 0;

    for (const matched of routedByMonth) {
      const nonEmpty = matched.filter((group) => group.logs.length > 0);
      if (nonEmpty.length === 0) {
        importedMonths.value += 1;
        continue;
      }

      try {
        for (const batch of splitGroupsIntoRequestBatches(nonEmpty)) {
          const writeResult = await options.importLogs({ dryRun: false, groups: batch });
          totalImported += writeResult.totalImported;
          totalSkippedExisting += writeResult.totalSkippedExisting;
        }
      } catch (err) {
        errorState.value = {
          messageKey: extractCaughtMessageKey(err, 'error.unknown'),
          monthsCompleted: importedMonths.value,
          totalMonths: totalMonths.value,
          stage: 'import',
        };
        phase.value = 'error';
        return;
      }

      importedMonths.value += 1;
    }

    result.value = {
      totalImported,
      totalSkippedExisting,
      totalUnmatched: preview.value.unassignedCount,
    };
    phase.value = 'done';
  }

  /** Re-runs the stage that failed. Safe to call repeatedly: mapping/preview is read-only and import skips what is already done (REQ-338). */
  async function retry(): Promise<void> {
    const failedStage = errorState.value?.stage;
    if (failedStage === 'import') {
      await startImport();
      return;
    }
    if (failedStage === 'mapping') {
      await advanceToPreview();
      return;
    }
    if (failedStage === 'scan' && lastRange) {
      await startScan(lastRange);
    }
  }

  function reset(): void {
    phase.value = 'range';
    scannedMonths.value = 0;
    importedMonths.value = 0;
    totalMonths.value = 0;
    mappingRows.value = [];
    selection.value = new Map();
    preview.value = { matched: [], unassignedCount: 0 };
    missingProjectIdHint.value = false;
    result.value = null;
    errorState.value = null;
    routedByMonth = [];
    bucketsByMonth = [];
    lastRange = null;
    cancelRequested = false;
  }

  return {
    phase,
    scannedMonths,
    importedMonths,
    totalMonths,
    mappingRows,
    selection,
    preview,
    missingProjectIdHint,
    hasNothingToImport,
    result,
    errorState,
    startScan,
    getMapping,
    setMapping,
    advanceToPreview,
    backToMapping,
    startImport,
    cancelScan,
    retry,
    reset,
  };
}
