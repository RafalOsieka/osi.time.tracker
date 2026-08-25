import { REMOTE_SECRET_HEADER } from '../../../shared/config/remote-secret';
import { extractCaughtMessageKey } from '../extractMessageKey';
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
import {
  RemoteAdapterError,
  type RemoteTrackerAdapter,
} from '../../../shared/types/remote-adapter';
import type { JsonObject } from '../../../shared/types/json';

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
    const response = await this.post<
      ProxiedRemoteIssueSearchDto,
      ProxiedRemoteIssueSearchResponseDto
    >('/api/remote/search', {
      trackerId: this.trackerId,
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
      trackerId: this.trackerId,
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
      trackerId: this.trackerId,
      remoteIssueId,
    });
    return response.options;
  }

  async getCurrentAccount(): Promise<RemoteAccount> {
    return this.post<ProxiedRemoteAccountDto, ProxiedRemoteAccountResponseDto>(
      '/api/remote/account',
      { trackerId: this.trackerId },
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
        trackerId: this.trackerId,
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
      { trackerId: this.trackerId, ...input },
    );
  }

  private async post<TBody, TResponse>(url: string, body: TBody): Promise<TResponse> {
    if (!this.secret) {
      throw new RemoteAdapterError('error.remoteServerModeSecretRequired');
    }
    const { $csrfFetch } = useNuxtApp();
    try {
      return await $csrfFetch<TResponse>(url, {
        method: 'POST',
        headers: { [REMOTE_SECRET_HEADER]: this.secret },
        // SAFETY: ofetch JSON body is a serializable DTO; FetchJsonBody is the nearest named map.
        body: body as JsonObject,
      });
    } catch (err) {
      throw new RemoteAdapterError(extractCaughtMessageKey(err, 'error.unknown'));
    }
  }
}
