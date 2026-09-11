import type { RemoteFieldOption } from '../contracts/remote-field-option.js';
import type { RemoteAccount } from '../contracts/remote-account.js';
import type {
  RemoteIssueLookup,
  RemoteIssueScope,
  RemoteIssueSearchResult,
} from '../contracts/remote-issue.js';
import type { RemoteProjectDto } from '../contracts/remote-project.js';
import type {
  RemoteTimeEntryDeleteOutcome,
  RemoteTimeLogDto,
} from '../contracts/remote-time-log.js';
import type { RemoteTrackerAdapter, Transport } from '../contracts/remote-adapter.js';
import { RemoteAdapterError } from '../contracts/remote-adapter.js';
import {
  mapTimeEntryDeleteFailure,
  mapTimeEntryDeleteStatus,
} from '../contracts/time-entry-delete.js';
import { rethrowAsAdapterError, UpstreamHttpError } from '../contracts/upstream-error.js';
import { OpenProjectClient, OPENPROJECT_TIME_LOGS_MAX_PAGES } from './client.js';

/**
 * L2: implements the neutral `RemoteTrackerAdapter` use-case surface over
 * `OpenProjectClient` (L3), owning every provider quirk so `client` and
 * `extension` execution modes behave identically: the bounded (50-page)
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

  async searchIssues(query: string, scope?: RemoteIssueScope): Promise<RemoteIssueSearchResult[]> {
    try {
      const { status, results } = await this.client.searchByTitle(query, this.secret, scope);
      if (scope && (status === 404 || status === 403)) {
        throw new RemoteAdapterError('error.remoteIssueSearchFailed', status);
      }
      return results;
    } catch (err) {
      rethrowAsAdapterError(err, 'error.remoteIssueSearchFailed');
    }
  }

  async getIssueById(
    remoteIssueId: string,
    scope?: RemoteIssueScope,
  ): Promise<RemoteIssueLookup | null> {
    try {
      if (scope) {
        const scoped = await this.client.findIssueInScope(remoteIssueId, scope, this.secret);
        if (scoped.status === 404 || scoped.status === 403) {
          throw new RemoteAdapterError('error.remoteIssueSearchFailed', scoped.status);
        }
        if (scoped.result) {
          return { result: scoped.result, inScope: true };
        }
      }
      const { result } = await this.client.getIssueById(remoteIssueId, this.secret);
      return result ? { result, inScope: !scope } : null;
    } catch (err) {
      if (err instanceof UpstreamHttpError && err.statusCode === 404) {
        return null;
      }
      rethrowAsAdapterError(err, 'error.remoteIssueSearchFailed');
    }
  }

  async listProjects(): Promise<RemoteProjectDto[]> {
    const projects: RemoteProjectDto[] = [];
    let offset = 1;

    try {
      for (let page = 0; page < OPENPROJECT_TIME_LOGS_MAX_PAGES; page += 1) {
        const result = await this.client.listProjectsPage({ offset }, this.secret);
        projects.push(...result.projects);
        if (result.projects.length === 0 || projects.length >= result.total) break;
        offset += 1;
      }
    } catch (err) {
      rethrowAsAdapterError(err, 'error.remoteProjectsFetchFailed');
    }

    return projects;
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

  async deleteTimeEntry(remoteLogId: string): Promise<RemoteTimeEntryDeleteOutcome> {
    try {
      const { status } = await this.client.deleteTimeEntry(remoteLogId, this.secret);
      return mapTimeEntryDeleteStatus(status);
    } catch (err) {
      if (
        err instanceof UpstreamHttpError ||
        err instanceof RemoteAdapterError ||
        err instanceof Error
      ) {
        return mapTimeEntryDeleteFailure(err);
      }
      return { status: 'unknown', messageKey: 'error.remoteExportDeleteUnknown' };
    }
  }
}
