import type { RemoteFieldOption } from '../../types/remote-field-option';
import type { RemoteAccount } from '../../types/remote-account';
import type { RemoteIssueSearchResult } from '../../types/remote-issue-ref';
import type { RemoteTimeLogDto } from '../../types/remote-export';
import type { RemoteTrackerAdapter, Transport } from '../../types/remote-adapter';
import { RemoteAdapterError } from '../../types/remote-adapter';
import { rethrowAsAdapterError, UpstreamHttpError } from '../upstream-error';
import { OpenProjectClient, OPENPROJECT_TIME_LOGS_MAX_PAGES } from './client';

/**
 * L2: implements the neutral `RemoteTrackerAdapter` use-case surface over
 * `OpenProjectClient` (L3), owning every provider quirk so `client` and
 * `server` execution modes behave identically: the bounded (50-page)
 * time-log pagination loop, 403 -> empty activities (a per-work-package
 * permission outcome, not a rejected credential), 404-on-id -> `null`
 * issue, and upstream-status -> `RemoteAdapterError` mapping.
 */
export class OpenProjectAdapter implements RemoteTrackerAdapter {
  private readonly client: OpenProjectClient;

  constructor(
    transport: Transport,
    baseUrl: string,
    private readonly secret: string | null,
  ) {
    this.client = new OpenProjectClient(transport, baseUrl);
  }

  async searchIssues(query: string): Promise<RemoteIssueSearchResult[]> {
    try {
      const { results } = await this.client.searchByTitle(query, this.secret);
      return results;
    } catch (err) {
      rethrowAsAdapterError(err, 'error.remoteIssueSearchFailed');
    }
  }

  async getIssueById(remoteIssueId: string): Promise<RemoteIssueSearchResult | null> {
    try {
      const { result } = await this.client.getIssueById(remoteIssueId, this.secret);
      return result;
    } catch (err) {
      if (err instanceof UpstreamHttpError && err.statusCode === 404) {
        return null;
      }
      rethrowAsAdapterError(err, 'error.remoteIssueSearchFailed');
    }
  }

  async getActivityOptions(remoteIssueId: string): Promise<RemoteFieldOption[]> {
    try {
      const { options } = await this.client.getActivityOptions(remoteIssueId, this.secret);
      return options;
    } catch (err) {
      // OpenProject returns 403 for work packages whose type doesn't allow
      // time logging (e.g. a "Summary" item) — a per-work-package
      // permission outcome, not a rejected credential — so treat it as an
      // empty result rather than a hard failure.
      if (err instanceof UpstreamHttpError && err.statusCode === 403) {
        return [];
      }
      rethrowAsAdapterError(err, 'error.remoteActivitiesFetchFailed');
    }
  }

  async getCurrentAccount(): Promise<RemoteAccount> {
    try {
      const { account } = await this.client.getCurrentAccount(this.secret);
      if (!account) {
        throw new RemoteAdapterError('error.remoteAccountFetchFailed', 502);
      }
      return account;
    } catch (err) {
      rethrowAsAdapterError(err, 'error.remoteAccountFetchFailed');
    }
  }

  async fetchTimeLogs(input: {
    spentOn: string;
    workPackageIds: string[];
    userId?: string;
  }): Promise<RemoteTimeLogDto[]> {
    const logs: RemoteTimeLogDto[] = [];
    let nextPageUrl: string | undefined;

    try {
      for (let page = 0; page < OPENPROJECT_TIME_LOGS_MAX_PAGES; page += 1) {
        const result = await this.client.fetchTimeLogsPage(
          {
            spentOn: input.spentOn,
            workPackageIds: input.workPackageIds,
            userId: input.userId,
            nextPageUrl,
          },
          this.secret,
        );
        logs.push(...result.logs);
        if (!result.nextPageUrl) break;
        nextPageUrl = result.nextPageUrl;
      }
    } catch (err) {
      rethrowAsAdapterError(err, 'error.remoteTimeLogsFetchFailed');
    }

    return logs;
  }

  async fetchTimeLogsInRange(input: {
    from: string;
    to: string;
    userId?: string;
  }): Promise<RemoteTimeLogDto[]> {
    const logs: RemoteTimeLogDto[] = [];
    let nextPageUrl: string | undefined;

    try {
      for (let page = 0; page < OPENPROJECT_TIME_LOGS_MAX_PAGES; page += 1) {
        const result = await this.client.fetchTimeLogsRangePage(
          {
            from: input.from,
            to: input.to,
            userId: input.userId,
            nextPageUrl,
          },
          this.secret,
        );
        logs.push(...result.logs);
        if (!result.nextPageUrl) break;
        nextPageUrl = result.nextPageUrl;
      }
    } catch (err) {
      rethrowAsAdapterError(err, 'error.remoteTimeLogsFetchFailed');
    }

    return logs;
  }

  async createTimeEntry(input: {
    remoteIssueId: string;
    spentOn: string;
    durationSeconds: number;
    activityId: string;
    comment?: string;
  }): Promise<{ remoteLogId: string }> {
    try {
      const { result } = await this.client.createTimeEntry(input, this.secret);
      if (!result) {
        throw new RemoteAdapterError('error.remoteExportCreateFailed', 502);
      }
      return result;
    } catch (err) {
      rethrowAsAdapterError(err, 'error.remoteExportCreateFailed');
    }
  }
}
