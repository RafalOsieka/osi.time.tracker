import type { RemoteFieldOption } from '../../types/remote-field-option';
import type { RemoteAccount } from '../../types/remote-account';
import type { RemoteIssueSearchResult } from '../../types/remote-issue-ref';
import type { RemoteTimeLogDto } from '../../types/remote-export';
import type { RemoteTrackerAdapter, Transport } from '../../types/remote-adapter';
import { RemoteAdapterError } from '../../types/remote-adapter';
import { RedmineClient, REDMINE_TIME_LOGS_MAX_PAGES } from './client';

/**
 * L2: implements the neutral `RemoteTrackerAdapter` use-case surface over
 * `RedmineClient` (L3), owning every provider quirk so `client` and `server`
 * execution modes behave identically: the bounded time-log pagination loop,
 * 404-on-id → `null` issue, and upstream-status → `RemoteAdapterError` mapping.
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

  async searchIssues(query: string): Promise<RemoteIssueSearchResult[]> {
    try {
      const { results } = await this.client.searchByTitle(query, this.secret);
      return results;
    } catch (err: unknown) {
      throw toAdapterError(err, 'error.remoteIssueSearchFailed');
    }
  }

  async getIssueById(remoteIssueId: string): Promise<RemoteIssueSearchResult | null> {
    try {
      const { result } = await this.client.getIssueById(remoteIssueId, this.secret);
      return result;
    } catch (err: unknown) {
      if (getUpstreamStatus(err) === 404) {
        return null;
      }
      throw toAdapterError(err, 'error.remoteIssueSearchFailed');
    }
  }

  /**
   * Accepts `remoteIssueId` per the neutral contract but ignores it —
   * Redmine activities come from the global enumeration (MVP).
   */
  async getActivityOptions(_remoteIssueId: string): Promise<RemoteFieldOption[]> {
    try {
      const { options } = await this.client.getActivityOptions(this.secret);
      return options;
    } catch (err: unknown) {
      throw toAdapterError(err, 'error.remoteActivitiesFetchFailed');
    }
  }

  async getCurrentAccount(): Promise<RemoteAccount> {
    try {
      const { account } = await this.client.getCurrentAccount(this.secret);
      if (!account) {
        throw new RemoteAdapterError('error.remoteAccountFetchFailed', 502);
      }
      return account;
    } catch (err: unknown) {
      throw toAdapterError(err, 'error.remoteAccountFetchFailed');
    }
  }

  async fetchTimeLogs(input: {
    spentOn: string;
    workPackageIds: string[];
    userId?: string;
  }): Promise<RemoteTimeLogDto[]> {
    const logs: RemoteTimeLogDto[] = [];
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
    } catch (err: unknown) {
      throw toAdapterError(err, 'error.remoteTimeLogsFetchFailed');
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
    } catch (err: unknown) {
      throw toAdapterError(err, 'error.remoteExportCreateFailed');
    }
  }
}

function getUpstreamStatus(err: unknown): number | undefined {
  if (err instanceof RemoteAdapterError) return err.status;
  return (
    (err as { statusCode?: number; response?: { status?: number } })?.statusCode ??
    (err as { response?: { status?: number } })?.response?.status
  );
}

/** Passes a same-origin-guard `RemoteAdapterError` through unchanged; maps anything else. */
function toAdapterError(err: unknown, failureMessageKey: string): RemoteAdapterError {
  if (err instanceof RemoteAdapterError) return err;

  const status = getUpstreamStatus(err);

  if (status === 401 || status === 403) {
    // Conceal the exact upstream status so the auth-rejection response
    // never leaks provider-specific detail about the rejected credential.
    return new RemoteAdapterError('error.remoteServerModeAuthRejected', 502);
  }

  if (status !== undefined) {
    return new RemoteAdapterError(failureMessageKey, status);
  }

  // No HTTP status at all: connection refused, timeout, or DNS failure.
  return new RemoteAdapterError('error.remoteServerModeConnectionFailed');
}
