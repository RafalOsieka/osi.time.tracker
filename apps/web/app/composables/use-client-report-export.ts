import type { RemoteTimeLogDto } from '@osi/remote-trackers/contracts';
import type { MessageParams } from '~~/shared/types/message-params';
import type {
  ReportLocale,
  ReportPresetDto,
  ReportPresetInput,
} from '~~/shared/types/report-preset';
import type { TrackerDto } from '~~/shared/types/tracker';
import { monthDateRange } from '~~/shared/utils/report-month';
import { buildClientReport } from '~/utils/client-report/build-client-report';
import {
  buildClientReportPdf,
  type ClientReportTranslate,
} from '~/utils/client-report/build-client-report-pdf';
import { clientReportFileName, createClientReportFormatters } from '~/utils/client-report/format';
import { loadPdfMake } from '~/utils/client-report/load-pdf-make';
import { createRemoteAdapter } from '~/utils/remote/create-remote-adapter';
import { extractCaughtMessageKey } from '~/utils/extract-message-key';
import { mapRemoteSyncClientError } from '~/composables/use-remote-sync-client';

export interface ClientReportExportRequest {
  input: ReportPresetInput;
  /** Preset being edited, or `null` to create one. */
  presetId: string | null;
  /** `YYYY-MM` */
  month: string;
  /** Active trackers of the user, to resolve each preset tracker's connection. */
  trackers: TrackerDto[];
}

export type ClientReportExportOutcome =
  | { status: 'downloaded' }
  | { status: 'empty' }
  /** The preset could not be saved; nothing else ran. */
  | { status: 'saveFailed'; messageKey: string; params?: MessageParams }
  /** Saved, then stopped before producing a file. */
  | { status: 'failed'; messageKey: string; params?: MessageParams };

export interface ClientReportExportResult {
  /** The saved preset, present whenever saving succeeded (even if the export then failed). */
  saved: ReportPresetDto | null;
  outcome: ClientReportExportOutcome;
}

/**
 * Exports the client report PDF (REQ-386): saves the preset first (design D7),
 * fetches every preset tracker's logs for the month in parallel, and builds and
 * downloads the PDF only when every fetch succeeded and something was logged.
 * `exporting` guards against a second concurrent export.
 */
export function useClientReportExport() {
  const { $csrfFetch, $i18n } = useNuxtApp();
  const { user } = useUserSession();
  const { effective } = useProfile();
  const { get: getSecret } = useTrackerSecret();
  const exporting = ref(false);

  async function translatorFor(locale: ReportLocale): Promise<ClientReportTranslate> {
    await $i18n.loadLocaleMessages(locale);
    return (key, params) => $i18n.t(key, params ?? {}, { locale });
  }

  function savePreset({ input, presetId }: ClientReportExportRequest) {
    return presetId
      ? $csrfFetch<ReportPresetDto>(`/api/report-presets/${presetId}`, {
          method: 'PATCH',
          body: input,
        })
      : $csrfFetch<ReportPresetDto>('/api/report-presets', { method: 'POST', body: input });
  }

  async function fetchLogs(
    saved: ReportPresetDto,
    request: ClientReportExportRequest,
  ): Promise<
    | { ok: true; trackers: TrackerDto[]; logsByTracker: Record<string, RemoteTimeLogDto[]> }
    | { ok: false; outcome: ClientReportExportOutcome }
  > {
    const byId = new Map(request.trackers.map((tracker) => [tracker.id, tracker]));

    // Every secret is checked before any tracker request is made.
    const connections: { name: string; tracker: TrackerDto; secret: string }[] = [];
    for (const { id, name } of saved.trackers) {
      const tracker = byId.get(id);
      const secret = getSecret(id);
      if (!tracker || !secret) {
        return {
          ok: false,
          outcome: {
            status: 'failed',
            messageKey: 'clientReport.missingSecret',
            params: { tracker: name },
          },
        };
      }
      connections.push({ name, tracker, secret });
    }

    const range = monthDateRange(request.month);
    // Each fetch settles to its own result, so a failure keeps the tracker it belongs to.
    const results = await Promise.all(
      connections.map(async ({ name, tracker, secret }) => {
        try {
          const logs = await createRemoteAdapter(tracker, secret).fetchTimeLogsInRange(range);
          return { ok: true as const, tracker, logs };
        } catch (err) {
          return { ok: false as const, name, err };
        }
      }),
    );

    const logsByTracker: Record<string, RemoteTimeLogDto[]> = {};
    for (const result of results) {
      if (!result.ok) {
        const reasonKey = mapRemoteSyncClientError(result.err, 'error.remoteTimeLogsFetchFailed');
        return {
          ok: false,
          outcome: {
            status: 'failed',
            messageKey: 'clientReport.trackerFailed',
            params: { tracker: result.name, reason: $i18n.t(reasonKey) },
          },
        };
      }
      logsByTracker[result.tracker.id] = result.logs;
    }
    const trackers = connections.map(({ tracker }) => tracker);
    return { ok: true, trackers, logsByTracker };
  }

  async function run(request: ClientReportExportRequest): Promise<ClientReportExportResult | null> {
    if (exporting.value) return null;
    exporting.value = true;
    try {
      let saved: ReportPresetDto;
      try {
        saved = await savePreset(request);
      } catch (err) {
        const messageKey = extractCaughtMessageKey(err, 'clientReport.saveFailed');
        return { saved: null, outcome: { status: 'saveFailed', messageKey } };
      }

      const fetched = await fetchLogs(saved, request);
      if (!fetched.ok) return { saved, outcome: fetched.outcome };
      if (Object.values(fetched.logsByTracker).every((logs) => logs.length === 0)) {
        return { saved, outcome: { status: 'empty' } };
      }

      try {
        const timeZone = effective.value.timeZone;
        const report = buildClientReport({
          preset: saved,
          trackers: fetched.trackers,
          logsByTracker: fetched.logsByTracker,
          month: request.month,
          user: {
            displayName: user.value?.displayName ?? null,
            email: user.value?.email ?? '',
          },
          generatedAt: new Date(),
          timeZone,
        });
        const t = await translatorFor(saved.locale);
        const doc = buildClientReportPdf(
          report,
          t,
          createClientReportFormatters(saved.locale, saved.hoursFormat, timeZone),
        );
        const pdfMake = await loadPdfMake();
        await pdfMake
          .createPdf(doc)
          .download(
            clientReportFileName(
              t('clientReport.pdf.fileNamePrefix'),
              saved.clientName,
              request.month,
            ),
          );
      } catch {
        return { saved, outcome: { status: 'failed', messageKey: 'clientReport.renderFailed' } };
      }
      return { saved, outcome: { status: 'downloaded' } };
    } finally {
      exporting.value = false;
    }
  }

  return { exporting, run };
}
