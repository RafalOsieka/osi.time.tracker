import { describe, expect, it } from 'vitest';
import { RedmineAdapter } from '../../shared/remote/redmine/adapter';
import {
  RemoteAdapterError,
  type RemoteRequest,
  type RemoteResponse,
  type Transport,
} from '../../shared/types/remote-adapter';
import {
  REDMINE_TIME_LOGS_MAX_PAGES,
  REDMINE_TIME_LOGS_PAGE_SIZE,
} from '../../shared/remote/redmine/client';

/** A `Transport` that throws for a status outside the 2xx range, mirroring a real transport's contract. */
function fakeTransport(
  handler: (request: RemoteRequest) => RemoteResponse | Promise<RemoteResponse>,
): Transport {
  return {
    async execute(request: RemoteRequest): Promise<RemoteResponse> {
      const response = await handler(request);
      if (response.status >= 400 && response.status !== 403 && response.status !== 404) {
        throw { statusCode: response.status };
      }
      return response;
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

  it('resolves a 404 exact-id lookup to null rather than throwing', async () => {
    const transport = fakeTransport(() => ({ status: 404, payload: {} }));
    const adapter = new RedmineAdapter(transport, 'https://rm.example.com', null);

    const result = await adapter.getIssueById('999');

    expect(result).toBeNull();
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
      async execute(): Promise<RemoteResponse> {
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
});
