import { REMOTE_SECRET_HEADER } from '../../../shared/config/remote-secret';
import { extractMessageKey } from '../extractMessageKey';
import type { RemoteFieldOption } from '../../../shared/types/remote-field-option';
import type { RemoteAccount } from '../../../shared/types/remote-account';
import type {
  ProxiedRemoteIssueSearchDto,
  ProxiedRemoteIssueSearchResponseDto,
  RemoteIssueSearchResult,
} from '../../../shared/types/remote-issue-ref';
import type {
  ProxiedRemoteAccountDto,
  ProxiedRemoteAccountResponseDto,
  ProxiedRemoteCreateTimeEntryDto,
  ProxiedRemoteCreateTimeEntryResponseDto,
  ProxiedRemoteTimeLogsDto,
  ProxiedRemoteTimeLogsResponseDto,
  RemoteTimeLogDto,
} from '../../../shared/types/remote-export';
import type {
  ProxiedRemoteActivitiesDto,
  ProxiedRemoteActivitiesResponseDto,
} from '../../../shared/types/remote-activities';
import type { RemoteTrackerAdapter } from '../../../shared/types/remote-adapter';

/**
 * `server` execution-mode adapter: a `RemoteTrackerAdapter` whose methods
 * each make one `$csrfFetch` call to the matching `/api/remote/*` endpoint
 * with the per-request secret header, and map any failure back to a
 * translation key via `extractMessageKey`. The Nitro handler on the other
 * end resolves the same provider adapter via `createServerRemoteAdapter`
 * (mirroring this side's `createRemoteAdapter`), so quirks and pagination
 * run once, server-side, regardless of provider.
 */
export class ServerExecutionAdapter implements RemoteTrackerAdapter {
  constructor(
    private readonly remoteSystemConfigId: string,
    private readonly secret: string | null,
  ) {}

  async searchIssues(query: string): Promise<RemoteIssueSearchResult[]> {
    const response = await this.post<
      ProxiedRemoteIssueSearchDto,
      ProxiedRemoteIssueSearchResponseDto
    >('/api/remote/search', {
      remoteSystemConfigId: this.remoteSystemConfigId,
      mode: 'title',
      query,
    });
    return response.results;
  }

  async getIssueById(remoteIssueId: string): Promise<RemoteIssueSearchResult | null> {
    const response = await this.post<
      ProxiedRemoteIssueSearchDto,
      ProxiedRemoteIssueSearchResponseDto
    >('/api/remote/search', {
      remoteSystemConfigId: this.remoteSystemConfigId,
      mode: 'id',
      query: remoteIssueId,
    });
    return response.results[0] ?? null;
  }

  async getActivityOptions(remoteIssueId: string): Promise<RemoteFieldOption[]> {
    const response = await this.post<
      ProxiedRemoteActivitiesDto,
      ProxiedRemoteActivitiesResponseDto
    >('/api/remote/activities', {
      remoteSystemConfigId: this.remoteSystemConfigId,
      remoteIssueId,
    });
    return response.options;
  }

  async getCurrentAccount(): Promise<RemoteAccount> {
    return this.post<ProxiedRemoteAccountDto, ProxiedRemoteAccountResponseDto>(
      '/api/remote/account',
      { remoteSystemConfigId: this.remoteSystemConfigId },
    );
  }

  async fetchTimeLogs(input: {
    spentOn: string;
    workPackageIds: string[];
    userId?: string;
  }): Promise<RemoteTimeLogDto[]> {
    const response = await this.post<ProxiedRemoteTimeLogsDto, ProxiedRemoteTimeLogsResponseDto>(
      '/api/remote/time-logs',
      {
        remoteSystemConfigId: this.remoteSystemConfigId,
        spentOn: input.spentOn,
        workPackageIds: input.workPackageIds,
        userId: input.userId,
      },
    );
    return response.logs;
  }

  async createTimeEntry(input: {
    remoteIssueId: string;
    spentOn: string;
    durationSeconds: number;
    activityId: string;
    comment?: string;
  }): Promise<{ remoteLogId: string }> {
    return this.post<ProxiedRemoteCreateTimeEntryDto, ProxiedRemoteCreateTimeEntryResponseDto>(
      '/api/remote/time-entries',
      { remoteSystemConfigId: this.remoteSystemConfigId, ...input },
    );
  }

  private async post<TBody extends Record<string, unknown>, TResponse>(
    url: string,
    body: TBody,
  ): Promise<TResponse> {
    if (!this.secret) {
      throw toLocalError('error.remoteServerModeSecretRequired');
    }
    const { $csrfFetch } = useNuxtApp();
    try {
      return await $csrfFetch<TResponse>(url, {
        method: 'POST',
        headers: { [REMOTE_SECRET_HEADER]: this.secret },
        body,
      });
    } catch (err: unknown) {
      throw toLocalError(extractMessageKey(err, 'error.unknown'));
    }
  }
}

/**
 * Wraps a failure in the same `data.data.messageKey` shape a Nitro
 * `createError` response carries, so `extractMessageKey` handles both
 * uniformly regardless of where the failure originated.
 */
function toLocalError(messageKey: string): { data: { data: { messageKey: string } } } {
  return { data: { data: { messageKey } } };
}
