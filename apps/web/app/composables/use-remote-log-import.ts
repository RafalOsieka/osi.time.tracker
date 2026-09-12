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
  routeLogsByScope,
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

export type ImportPhase = 'range' | 'scanning' | 'preview' | 'importing' | 'done' | 'error';

export interface ImportProjectPreview {
  projectId: string;
  wouldImport: number;
  skippedExisting: number;
  /** Distinct remote project titles (or ids, when a title is unavailable) routed into this Project. */
  remoteProjectTitles: string[];
}

/** Logs that matched no scoped Project, bucketed by remote project (REQ-334). */
export interface ImportUnmatchedPreview {
  remoteProjectId: string | null;
  remoteProjectTitle: string | null;
  count: number;
}

export interface ImportPreview {
  matched: ImportProjectPreview[];
  unmatched: ImportUnmatchedPreview[];
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
  stage: 'scan' | 'import';
}

/**
 * Phase state machine for tracker-level remote-log import (REQ-334/REQ-340):
 * scans a date range month by month (catalog + range fetch + a dry-run
 * import to get preview counts), then imports month by month on confirm.
 * Both phases reuse the same routing (REQ-334) and idempotent write
 * endpoint, so a failed month can simply be retried from the top — already
 * -imported logs are skipped server-side (REQ-338).
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
  const preview = ref<ImportPreview>({ matched: [], unmatched: [] });
  const missingProjectIdHint = ref(false);
  const result = ref<ImportRunResult | null>(null);
  const errorState = ref<ImportErrorState | null>(null);

  let lastRange: DateRange | null = null;
  let cancelRequested = false;
  // Matched groups per month, kept from the scan so import can reuse them
  // without re-fetching or re-routing.
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
   * Records which remote projects fed each matched local Project, straight
   * from the routed logs (client-side), independent of the server's
   * per-Project dry-run counts — the write endpoint only reports totals per
   * local Project, never per remote project.
   */
  function mergeRemoteProjectTitles(
    target: Map<string, ImportProjectPreview>,
    matched: RouteLogsByScopeGroup[],
  ): void {
    for (const group of matched) {
      const slot = projectPreviewSlot(target, group.projectId);
      for (const log of group.logs) {
        const title = log.remoteProjectTitle ?? log.remoteProjectId;
        if (title && !slot.remoteProjectTitles.includes(title)) {
          slot.remoteProjectTitles.push(title);
        }
      }
    }
  }

  function mergeUnmatched(
    target: Map<string, ImportUnmatchedPreview>,
    groups: {
      remoteProjectId: string | null;
      remoteProjectTitle: string | null;
      logs: unknown[];
    }[],
  ): void {
    for (const group of groups) {
      const key = group.remoteProjectId ?? '';
      const existing = target.get(key) ?? {
        remoteProjectId: group.remoteProjectId,
        remoteProjectTitle: group.remoteProjectTitle,
        count: 0,
      };
      existing.count += group.logs.length;
      target.set(key, existing);
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
    routedByMonth = [];

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
    const matchedTotals = new Map<string, ImportProjectPreview>();
    const unmatchedTotals = new Map<string, ImportUnmatchedPreview>();

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

      const routed = routeLogsByScope(logs, catalog, scopedProjects());
      routedByMonth.push(routed.matched);
      mergeUnmatched(unmatchedTotals, routed.unmatched);
      mergeRemoteProjectTitles(matchedTotals, routed.matched);

      try {
        for (const batch of splitGroupsIntoRequestBatches(routed.matched)) {
          const dryRunResult = await options.importLogs({ dryRun: true, groups: batch });
          mergeProjectPreview(matchedTotals, dryRunResult);
        }
      } catch (err) {
        errorState.value = {
          messageKey: extractCaughtMessageKey(err, 'error.unknown'),
          monthsCompleted: scannedMonths.value,
          totalMonths: totalMonths.value,
          stage: 'scan',
        };
        phase.value = 'error';
        return;
      }

      scannedMonths.value += 1;
    }

    preview.value = {
      matched: [...matchedTotals.values()].map((project) => ({
        ...project,
        remoteProjectTitles: [...project.remoteProjectTitles].sort(),
      })),
      unmatched: [...unmatchedTotals.values()],
    };
    phase.value = 'preview';
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
      totalUnmatched: preview.value.unmatched.reduce((sum, bucket) => sum + bucket.count, 0),
    };
    phase.value = 'done';
  }

  /** Re-runs the stage that failed. Safe to call repeatedly: scanning is read-only and import skips what is already done (REQ-338). */
  async function retry(): Promise<void> {
    const failedStage = errorState.value?.stage;
    if (failedStage === 'import') {
      await startImport();
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
    preview.value = { matched: [], unmatched: [] };
    missingProjectIdHint.value = false;
    result.value = null;
    errorState.value = null;
    routedByMonth = [];
    lastRange = null;
    cancelRequested = false;
  }

  return {
    phase,
    scannedMonths,
    importedMonths,
    totalMonths,
    preview,
    missingProjectIdHint,
    hasNothingToImport,
    result,
    errorState,
    startScan,
    startImport,
    cancelScan,
    retry,
    reset,
  };
}
