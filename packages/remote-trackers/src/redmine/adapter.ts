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
import {
  RedmineClient,
  REDMINE_ISSUE_TITLE_BATCH_SIZE,
  REDMINE_TIME_LOGS_MAX_PAGES,
  type RedmineTimeLogEntry,
} from './client.js';

/**
 * L2: implements the neutral `RemoteTrackerAdapter` use-case surface over
 * `RedmineClient` (L3), owning every provider quirk so `client` and
 * `extension` execution modes behave identically: the bounded time-log pagination loop,
 * issue-title resolution for time logs (REQ-343/REQ-378), 404-on-id → `null` issue,
 * and upstream-status → `RemoteAdapterError` mapping.
 */
export class RedmineAdapter implements RemoteTrackerAdapter {
  private readonly client: RedmineClient;

  constructor(
    transport: Transport,
    baseUrl: string,
    private readonly secret: string | null,
  ) {
    this.client = new RedmineClient(transport, baseUrl);
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
    let offset = 0;

    try {
      for (let page = 0; page < REDMINE_TIME_LOGS_MAX_PAGES; page += 1) {
        const result = await this.client.listProjectsPage({ offset }, this.secret);
        projects.push(...result.projects);
        if (result.nextOffset == null) break;
        offset = result.nextOffset;
      }
    } catch (err) {
      rethrowAsAdapterError(err, 'error.remoteProjectsFetchFailed');
    }

    return projects;
  }

  /**
   * Accepts `remoteIssueId` per the neutral contract but ignores it —
   * Redmine activities come from the global enumeration (MVP).
   */
  async getActivityOptions(_remoteIssueId: string): Promise<RemoteFieldOption[]> {
    try {
      const { options } = await this.client.getActivityOptions(this.secret);
      return options;
    } catch (err) {
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
    const logs: RedmineTimeLogEntry[] = [];
    let offset = 0;

    try {
      for (let page = 0; page < REDMINE_TIME_LOGS_MAX_PAGES; page += 1) {
        const result = await this.client.fetchTimeLogsPage(
          {
            spentOn: input.spentOn,
            issueIds: input.workPackageIds,
            userId: input.userId,
            offset,
          },
          this.secret,
        );
        logs.push(...result.logs);
        if (result.nextOffset == null) break;
        offset = result.nextOffset;
      }
      return await this.withIssueTitles(logs);
    } catch (err) {
      rethrowAsAdapterError(err, 'error.remoteTimeLogsFetchFailed');
    }
  }

  async fetchTimeLogsInRange(input: {
    from: string;
    to: string;
    userId?: string;
  }): Promise<RemoteTimeLogDto[]> {
    const logs: RedmineTimeLogEntry[] = [];
    let offset = 0;

    try {
      for (let page = 0; page < REDMINE_TIME_LOGS_MAX_PAGES; page += 1) {
        const result = await this.client.fetchTimeLogsRangePage(
          {
            from: input.from,
            to: input.to,
            userId: input.userId,
            offset,
          },
          this.secret,
        );
        logs.push(...result.logs);
        if (result.nextOffset == null) break;
        offset = result.nextOffset;
      }
      return await this.withIssueTitles(logs);
    } catch (err) {
      rethrowAsAdapterError(err, 'error.remoteTimeLogsFetchFailed');
    }
  }

  /**
   * Resolves issue subjects (any status) for the given ids, one request per
   * 100 ids (REQ-378). Ids the tracker does not return are absent from the
   * map. Any non-success response or unusable payload throws, so the calling
   * fetch fails instead of reporting `null` titles. Provider-private: not
   * part of `RemoteTrackerAdapter` or the extension bridge.
   */
  async getIssuesByIds(remoteIssueIds: string[]): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    for (let i = 0; i < remoteIssueIds.length; i += REDMINE_ISSUE_TITLE_BATCH_SIZE) {
      const chunk = remoteIssueIds.slice(i, i + REDMINE_ISSUE_TITLE_BATCH_SIZE);
      const result = await this.client.getIssueTitlesByIds(chunk, this.secret);
      if (result.status !== 200) throw new UpstreamHttpError(result.status);
      if (!result.titles) throw new RemoteAdapterError('error.remoteTimeLogsFetchFailed', 502);
      for (const [id, title] of result.titles) titles.set(id, title);
    }
    return titles;
  }

  /**
   * Time-entry payloads never carry the issue subject (REQ-343), so every
   * log's title comes from one lookup over the distinct issue ids; ids the
   * tracker does not return become `null` (REQ-476/REQ-378).
   */
  private async withIssueTitles(logs: RedmineTimeLogEntry[]): Promise<RemoteTimeLogDto[]> {
    const titles = await this.getIssuesByIds([...new Set(logs.map((log) => log.remoteIssueId))]);
    return logs.map((log) => ({ ...log, remoteIssueTitle: titles.get(log.remoteIssueId) ?? null }));
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
