import { describe, expect, it } from 'vitest';
import {
  RedmineAdapter,
  REDMINE_TIME_LOGS_MAX_PAGES,
  REDMINE_TIME_LOGS_PAGE_SIZE,
} from '@osi/remote-trackers/redmine';
import type { ZodType } from 'zod';
import {
  RemoteAdapterError,
  UpstreamHttpError,
  type RemoteRequest,
  type RemoteResponse,
  type Transport,
} from '@osi/remote-trackers/contracts';

/** A `Transport` that throws for a status outside the 2xx range, mirroring a real transport's contract. */
function fakeTransport(
  handler: (request: RemoteRequest) => RemoteResponse | Promise<RemoteResponse>,
): Transport {
  return {
    async execute<T>(request: RemoteRequest, schema: ZodType<T>): Promise<RemoteResponse<T>> {
      const response = await handler(request);
      if (response.status >= 400 && response.status !== 403 && response.status !== 404) {
        throw new UpstreamHttpError(response.status);
      }
      const parsed = schema.safeParse(response.payload);
      return { status: response.status, payload: parsed.success ? parsed.data : null };
    },
  };
}

describe('RedmineAdapter', () => {
  it('follows offset/limit pagination across pages until nextOffset is null', async () => {
    let calls = 0;
    const transport = fakeTransport((request) => {
      calls += 1;
      const url = new URL(request.url);
      const offset = Number(url.searchParams.get('offset') ?? '0');
      if (offset === 0) {
        return {
          status: 200,
          payload: {
            time_entries: [
              {
                id: 1,
                spent_on: '2026-03-15',
                hours: 1,
                issue: { id: 42 },
              },
            ],
            total_count: REDMINE_TIME_LOGS_PAGE_SIZE + 1,
            offset: 0,
            limit: REDMINE_TIME_LOGS_PAGE_SIZE,
          },
        };
      }
      return {
        status: 200,
        payload: {
          time_entries: [
            {
              id: 2,
              spent_on: '2026-03-15',
              hours: 0.5,
              issue: { id: 42 },
            },
          ],
          total_count: REDMINE_TIME_LOGS_PAGE_SIZE + 1,
          offset: REDMINE_TIME_LOGS_PAGE_SIZE,
          limit: REDMINE_TIME_LOGS_PAGE_SIZE,
        },
      };
    });
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    const logs = await adapter.fetchTimeLogs({ spentOn: '2026-03-15', workPackageIds: ['42'] });

    expect(calls).toBe(2);
    expect(logs.map((log) => log.remoteLogId)).toEqual(['1', '2']);
  });

  it('bounds the pagination loop at the fixed maximum page count', async () => {
    let calls = 0;
    const transport = fakeTransport(() => {
      calls += 1;
      return {
        status: 200,
        payload: {
          // Always claim there are more pages.
          time_entries: [
            {
              id: calls,
              spent_on: '2026-03-15',
              hours: 1,
              issue: { id: 42 },
            },
          ],
          total_count: 1_000_000,
        },
      };
    });
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    const logs = await adapter.fetchTimeLogs({ spentOn: '2026-03-15', workPackageIds: ['42'] });

    expect(calls).toBe(REDMINE_TIME_LOGS_MAX_PAGES);
    expect(logs).toHaveLength(REDMINE_TIME_LOGS_MAX_PAGES);
  });

  it('paginates a date-range fetch without filtering issues and includes unlinked logs', async () => {
    let calls = 0;
    const transport = fakeTransport(() => {
      calls += 1;
      if (calls === 1) {
        return {
          status: 200,
          payload: {
            time_entries: [
              {
                id: 1,
                spent_on: '2026-08-03',
                hours: 1,
                issue: { id: 99 },
              },
            ],
            total_count: 2,
            offset: 0,
            limit: REDMINE_TIME_LOGS_PAGE_SIZE,
          },
        };
      }
      return {
        status: 200,
        payload: {
          time_entries: [
            {
              id: 2,
              spent_on: '2026-08-12',
              hours: 0.5,
              issue: { id: 99 },
            },
          ],
          total_count: 2,
          offset: REDMINE_TIME_LOGS_PAGE_SIZE,
          limit: REDMINE_TIME_LOGS_PAGE_SIZE,
        },
      };
    });
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    const logs = await adapter.fetchTimeLogsInRange({ from: '2026-08-01', to: '2026-08-31' });

    expect(calls).toBe(2);
    expect(logs.map((log) => log.remoteLogId)).toEqual(['1', '2']);
    expect(logs[0]?.remoteIssueId).toBe('99');
  });

  it('maps a range-fetch upstream failure to RemoteAdapterError', async () => {
    const transport = fakeTransport(() => ({ status: 500, payload: {} }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    await expect(
      adapter.fetchTimeLogsInRange({ from: '2026-08-01', to: '2026-08-31' }),
    ).rejects.toMatchObject({ messageKey: 'error.remoteTimeLogsFetchFailed' });
  });

  it('resolves a 404 exact-id lookup to null rather than throwing', async () => {
    const transport = fakeTransport(() => ({ status: 404, payload: {} }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    const result = await adapter.getIssueById('999');

    expect(result).toBeNull();
  });

  it('marks an unscoped lookup as in scope', async () => {
    const transport = fakeTransport(() => ({
      status: 200,
      payload: { issue: { id: 42, subject: 'Ship it' } },
    }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    const lookup = await adapter.getIssueById('42');

    expect(lookup).toEqual({ result: { remoteIssueId: '42', title: 'Ship it' }, inScope: true });
  });

  it('finds a scoped descendant issue without a second request', async () => {
    let calls = 0;
    const transport = fakeTransport(() => {
      calls += 1;
      return { status: 200, payload: { issues: [{ id: 8, subject: 'Child issue' }] } };
    });
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    const lookup = await adapter.getIssueById('8', { remoteProjectId: '3' });

    expect(calls).toBe(1);
    expect(lookup).toEqual({
      result: { remoteIssueId: '8', title: 'Child issue' },
      inScope: true,
    });
  });

  it('falls back to the direct lookup and marks it outside scope', async () => {
    let calls = 0;
    const transport = fakeTransport((request) => {
      calls += 1;
      if (calls === 1) {
        expect(request.url).toContain('/issues.json');
        return { status: 200, payload: { issues: [] } };
      }
      expect(request.url).toBe('https://rm.example.com/issues/9.json');
      return { status: 200, payload: { issue: { id: 9, subject: 'Unrelated issue' } } };
    });
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    const lookup = await adapter.getIssueById('9', { remoteProjectId: '3' });

    expect(calls).toBe(2);
    expect(lookup).toEqual({
      result: { remoteIssueId: '9', title: 'Unrelated issue' },
      inScope: false,
    });
  });

  it('resolves not-found when neither the scoped nor the direct lookup finds the issue', async () => {
    let calls = 0;
    const transport = fakeTransport(() => {
      calls += 1;
      return calls === 1 ? { status: 200, payload: { issues: [] } } : { status: 404, payload: {} };
    });
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    const lookup = await adapter.getIssueById('999', { remoteProjectId: '3' });

    expect(lookup).toBeNull();
  });

  it('raises the search error when the scoped project is gone (404)', async () => {
    const transport = fakeTransport(() => ({ status: 404, payload: {} }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    await expect(adapter.getIssueById('8', { remoteProjectId: 'bogus' })).rejects.toMatchObject({
      messageKey: 'error.remoteIssueSearchFailed',
    });
  });

  it('raises the search error when the scoped project is forbidden (403)', async () => {
    const transport = fakeTransport(() => ({ status: 403, payload: {} }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    await expect(
      adapter.searchIssues('anything', { remoteProjectId: 'forbidden' }),
    ).rejects.toMatchObject({ messageKey: 'error.remoteIssueSearchFailed' });
  });

  it('lists projects across pages and stops at the pagination bound', async () => {
    let calls = 0;
    const transport = fakeTransport(() => {
      calls += 1;
      return {
        status: 200,
        payload: {
          projects: [{ id: calls, name: `Project ${calls}` }],
          total_count: 1_000_000,
        },
      };
    });
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    const projects = await adapter.listProjects();

    expect(calls).toBe(REDMINE_TIME_LOGS_MAX_PAGES);
    expect(projects).toHaveLength(REDMINE_TIME_LOGS_MAX_PAGES);
  });

  it('maps a project-catalog failure to its own messageKey', async () => {
    const transport = fakeTransport(() => ({ status: 500, payload: {} }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    await expect(adapter.listProjects()).rejects.toMatchObject({
      messageKey: 'error.remoteProjectsFetchFailed',
    });
  });

  it('ignores the remote issue id when fetching activity options', async () => {
    const transport = fakeTransport((request) => {
      expect(request.url).toContain('/enumerations/time_entry_activities.json');
      return {
        status: 200,
        payload: { time_entry_activities: [{ id: 1, name: 'Development', active: true }] },
      };
    });
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', 'secret');

    const options = await adapter.getActivityOptions('42');

    expect(options).toEqual([{ id: '1', name: 'Development' }]);
  });

  it('maps a rejected credential to a distinct auth-rejected messageKey', async () => {
    const transport = fakeTransport(() => ({ status: 401, payload: {} }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', 'bad-secret');

    await expect(adapter.searchIssues('anything')).rejects.toMatchObject({
      messageKey: 'error.remoteServerModeAuthRejected',
    });
  });

  it('maps a generic upstream failure to the operation-specific messageKey', async () => {
    const transport = fakeTransport(() => ({ status: 500, payload: {} }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    await expect(adapter.searchIssues('anything')).rejects.toMatchObject({
      messageKey: 'error.remoteIssueSearchFailed',
    });
  });

  it('maps a connection failure with no status to the connection-failed messageKey', async () => {
    const transport: Transport = {
      async execute<T>(_request: RemoteRequest, _schema: ZodType<T>): Promise<RemoteResponse<T>> {
        throw new Error('ECONNREFUSED');
      },
    };
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    await expect(adapter.getCurrentAccount()).rejects.toBeInstanceOf(RemoteAdapterError);
    await expect(adapter.getCurrentAccount()).rejects.toMatchObject({
      messageKey: 'error.remoteServerModeConnectionFailed',
    });
  });

  it('creates a time entry and returns the remote log id', async () => {
    const transport = fakeTransport(() => ({
      status: 201,
      payload: { time_entry: { id: 99 } },
    }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', 'secret');

    const result = await adapter.createTimeEntry({
      remoteIssueId: '42',
      spentOn: '2026-03-15',
      durationSeconds: 900,
      activityId: '5',
    });

    expect(result).toEqual({ remoteLogId: '99' });
  });

  it('deletes a time entry', async () => {
    const transport = fakeTransport(() => ({ status: 204, payload: null }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', 'secret');

    await expect(adapter.deleteTimeEntry('99')).resolves.toEqual({ status: 'deleted' });
  });

  it('maps a missing time entry to not_found', async () => {
    const transport = fakeTransport(() => ({ status: 404, payload: null }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', 'secret');

    await expect(adapter.deleteTimeEntry('missing')).resolves.toEqual({ status: 'not_found' });
  });

  it('maps an auth rejection to a rejected delete outcome', async () => {
    const transport = fakeTransport(() => ({ status: 401, payload: {} }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', 'bad-secret');

    await expect(adapter.deleteTimeEntry('99')).resolves.toEqual({
      status: 'rejected',
      messageKey: 'error.remoteServerModeAuthRejected',
    });
  });

  it('maps a lost delete response to unknown', async () => {
    const transport: Transport = {
      async execute<T>(_request: RemoteRequest, _schema: ZodType<T>): Promise<RemoteResponse<T>> {
        throw new Error('ECONNRESET');
      },
    };
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', 'secret');

    await expect(adapter.deleteTimeEntry('99')).resolves.toEqual({
      status: 'unknown',
      messageKey: 'error.remoteExportDeleteUnknown',
    });
  });
});
