import { z, type ZodType } from 'zod';
import { REMOTE_SECRET_HEADER } from '~~/shared/config/remote-secret';
import type { RemoteFieldOption } from '../../../shared/types/remote-field-option';
import type { RemoteAccount } from '../../../shared/types/remote-account';
import type {
  ProxiedRemoteIssueSearchDto,
  RemoteIssueSearchResult,
} from '../../../shared/types/remote-issue-ref';
import type {
  ProxiedRemoteAccountDto,
  ProxiedRemoteCreateTimeEntryDto,
  ProxiedRemoteTimeLogsDto,
  RemoteTimeLogDto,
} from '../../../shared/types/remote-export';
import type { ProxiedRemoteActivitiesDto } from '../../../shared/types/remote-activities';
import {
  RemoteAdapterError,
  type RemoteTrackerAdapter,
} from '../../../shared/types/remote-adapter';

const issueSearchResponseSchema = z.object({
  results: z.array(
    z.object({
      remoteIssueId: z.string(),
      title: z.string(),
      remoteProjectTitle: z.string().optional(),
    }),
  ),
});
const activitiesResponseSchema = z.object({
  options: z.array(z.object({ id: z.string(), name: z.string() })),
});
const accountResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
});
const timeLogsResponseSchema = z.object({
  logs: z.array(
    z.object({
      remoteLogId: z.string(),
      remoteIssueId: z.string(),
      spentOn: z.string(),
      durationSeconds: z.number(),
      activityId: z.string().nullable(),
      activityName: z.string().nullable(),
      comment: z.string().nullable(),
      remoteUserId: z.string().nullable(),
    }),
  ),
});
const createTimeEntryResponseSchema = z.object({
  remoteLogId: z.string(),
});

type ProxiedRemotePostBody =
  | ProxiedRemoteIssueSearchDto
  | ProxiedRemoteActivitiesDto
  | ProxiedRemoteAccountDto
  | ProxiedRemoteTimeLogsDto
  | ProxiedRemoteCreateTimeEntryDto;

/**
 * `server` execution-mode adapter: a `RemoteTrackerAdapter` whose methods
 * each make one `$csrfFetch` call to the matching `/api/remote/*` endpoint
 * with the per-request secret header, and map any failure back to a
 * translation key via `RemoteAdapterError`. The Nitro handler on the other
 * end resolves the same provider adapter via `createServerRemoteAdapter`
 * (mirroring this side's `createRemoteAdapter`), so quirks and pagination
 * run once, server-side, regardless of provider.
 */
export class ServerExecutionAdapter implements RemoteTrackerAdapter {
  constructor(
    private readonly trackerId: string,
    private readonly secret: string | null,
  ) {}

  async searchIssues(query: string): Promise<RemoteIssueSearchResult[]> {
    const { results } = await this.post(
      '/api/remote/search',
      { trackerId: this.trackerId, mode: 'title', query },
      issueSearchResponseSchema,
    );
    return results;
  }

  async getIssueById(remoteIssueId: string): Promise<RemoteIssueSearchResult | null> {
    const { results } = await this.post(
      '/api/remote/search',
      { trackerId: this.trackerId, mode: 'id', query: remoteIssueId },
      issueSearchResponseSchema,
    );
    return results[0] ?? null;
  }

  async getActivityOptions(remoteIssueId: string): Promise<RemoteFieldOption[]> {
    const { options } = await this.post(
      '/api/remote/activities',
      { trackerId: this.trackerId, remoteIssueId },
      activitiesResponseSchema,
    );
    return options;
  }

  async getCurrentAccount(): Promise<RemoteAccount> {
    return this.post('/api/remote/account', { trackerId: this.trackerId }, accountResponseSchema);
  }

  async fetchTimeLogs(input: {
    spentOn: string;
    workPackageIds: string[];
    userId?: string;
  }): Promise<RemoteTimeLogDto[]> {
    const { logs } = await this.post(
      '/api/remote/time-logs',
      {
        trackerId: this.trackerId,
        spentOn: input.spentOn,
        workPackageIds: input.workPackageIds,
        userId: input.userId,
      },
      timeLogsResponseSchema,
    );
    return logs;
  }

  async createTimeEntry(input: {
    remoteIssueId: string;
    spentOn: string;
    durationSeconds: number;
    activityId: string;
    comment?: string;
  }): Promise<{ remoteLogId: string }> {
    return this.post(
      '/api/remote/time-entries',
      { trackerId: this.trackerId, ...input },
      createTimeEntryResponseSchema,
    );
  }

  private async post<T>(url: string, body: ProxiedRemotePostBody, schema: ZodType<T>): Promise<T> {
    if (!this.secret) {
      throw new RemoteAdapterError('error.remoteServerModeSecretRequired');
    }
    const { $csrfFetch } = useNuxtApp();
    try {
      const parsed = schema.safeParse(
        await $csrfFetch(url, {
          method: 'POST',
          headers: { [REMOTE_SECRET_HEADER]: this.secret },
          body,
        }),
      );
      if (!parsed.success) throw new RemoteAdapterError('error.unknown');
      return parsed.data;
    } catch (err) {
      if (err instanceof RemoteAdapterError) throw err;
      throw new RemoteAdapterError(extractCaughtMessageKey(err, 'error.unknown'));
    }
  }
}
