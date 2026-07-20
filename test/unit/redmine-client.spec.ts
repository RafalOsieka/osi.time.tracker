import { describe, expect, it } from 'vitest';
import {
  RedmineClient,
  REDMINE_TIME_LOGS_PAGE_SIZE,
  REDMINE_TITLE_SEARCH_MAX_RESULTS,
} from '../../shared/remote/redmine/client';
import type { RemoteRequest, RemoteResponse, Transport } from '../../shared/types/remote-adapter';

/** Records every request it is asked to execute and returns canned responses in order. */
function fakeTransport(responses: RemoteResponse[]): Transport & { requests: RemoteRequest[] } {
  const requests: RemoteRequest[] = [];
  let index = 0;
  return {
    requests,
    async execute(request: RemoteRequest): Promise<RemoteResponse> {
      requests.push(request);
      const response = responses[Math.min(index, responses.length - 1)]!;
      index += 1;
      return response;
    },
  };
}

describe('RedmineClient', () => {
  it('builds a title-search request with the API-key header and a bounded page size', async () => {
    const transport = fakeTransport([
      { status: 200, payload: { issues: [{ id: 1, subject: 'Fix bug' }] } },
    ]);
    const client = new RedmineClient(transport, 'https://rm.example.com/');

    const { status, results } = await client.searchByTitle('Fix bug', 'secret-api-key');

    expect(status).toBe(200);
    expect(results).toEqual([{ remoteIssueId: '1', title: 'Fix bug' }]);
    const request = transport.requests[0]!;
    expect(request.method).toBe('GET');
    expect(request.headers?.['X-Redmine-API-Key']).toBe('secret-api-key');
    expect(request.headers?.Authorization).toBeUndefined();
    const url = new URL(request.url);
    expect(url.origin + url.pathname).toBe('https://rm.example.com/issues.json');
    expect(url.searchParams.get('limit')).toBe(String(REDMINE_TITLE_SEARCH_MAX_RESULTS));
    expect(url.searchParams.get('status_id')).toBe('*');
    expect(url.searchParams.get('subject')).toBe('~Fix bug');
  });

  it('skips malformed title-search elements and caps results', async () => {
    const elements = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      subject: `Issue ${i + 1}`,
    }));
    elements.push({ id: 'bad' as unknown as number, subject: 123 as unknown as string });
    const transport = fakeTransport([{ status: 200, payload: { issues: elements } }]);
    const client = new RedmineClient(transport, 'https://rm.example.com');

    const { results } = await client.searchByTitle('Issue', null);

    expect(results).toHaveLength(REDMINE_TITLE_SEARCH_MAX_RESULTS);
    expect(results[0]).toEqual({ remoteIssueId: '1', title: 'Issue 1' });
  });

  it('builds an exact-id lookup request and returns null for a 404 status', async () => {
    const transport = fakeTransport([{ status: 404, payload: {} }]);
    const client = new RedmineClient(transport, 'https://rm.example.com');

    const { status, result } = await client.getIssueById('42', null);

    expect(status).toBe(404);
    expect(result).toBeNull();
    expect(transport.requests[0]!.url).toBe('https://rm.example.com/issues/42.json');
  });

  it('parses a successful exact-id lookup', async () => {
    const transport = fakeTransport([
      { status: 200, payload: { issue: { id: 42, subject: 'Ship it' } } },
    ]);
    const client = new RedmineClient(transport, 'https://rm.example.com');

    const { result } = await client.getIssueById('42', 'secret');

    expect(result).toEqual({ remoteIssueId: '42', title: 'Ship it' });
  });

  it('fetches global time-entry activities and skips inactive entries', async () => {
    const transport = fakeTransport([
      {
        status: 200,
        payload: {
          time_entry_activities: [
            { id: 1, name: 'Development', active: true },
            { id: 2, name: 'Retired', active: false },
            { id: 3, name: 'Design' },
            { id: 'bad', name: 123 },
          ],
        },
      },
    ]);
    const client = new RedmineClient(transport, 'https://rm.example.com');

    const { options } = await client.getActivityOptions('secret');

    expect(options).toEqual([
      { id: '1', name: 'Development' },
      { id: '3', name: 'Design' },
    ]);
    expect(transport.requests[0]!.url).toBe(
      'https://rm.example.com/enumerations/time_entry_activities.json',
    );
  });

  it('resolves the current account from /users/current.json', async () => {
    const transport = fakeTransport([
      {
        status: 200,
        payload: { user: { id: 7, firstname: 'Ada', lastname: 'Lovelace', login: 'ada' } },
      },
    ]);
    const client = new RedmineClient(transport, 'https://rm.example.com');

    const { account } = await client.getCurrentAccount('secret');

    expect(account).toEqual({ id: '7', name: 'Ada Lovelace' });
    expect(transport.requests[0]!.url).toBe('https://rm.example.com/users/current.json');
  });

  it('falls back to login when firstname/lastname are empty', async () => {
    const transport = fakeTransport([
      { status: 200, payload: { user: { id: 7, firstname: '', lastname: '', login: 'ada' } } },
    ]);
    const client = new RedmineClient(transport, 'https://rm.example.com');

    const { account } = await client.getCurrentAccount(null);

    expect(account).toEqual({ id: '7', name: 'ada' });
  });

  it('builds an offset/limit time-logs request and exposes the next offset', async () => {
    const transport = fakeTransport([
      {
        status: 200,
        payload: {
          time_entries: [
            {
              id: 11,
              spent_on: '2026-03-15',
              hours: 1,
              comments: 'hello',
              issue: { id: 42 },
              activity: { id: 3, name: 'Dev' },
              user: { id: 7 },
            },
          ],
          total_count: 150,
          offset: 0,
          limit: REDMINE_TIME_LOGS_PAGE_SIZE,
        },
      },
    ]);
    const client = new RedmineClient(transport, 'https://rm.example.com');

    const page = await client.fetchTimeLogsPage(
      { spentOn: '2026-03-15', issueIds: ['42', '43'], userId: '7' },
      null,
    );

    expect(page.logs).toEqual([
      {
        remoteLogId: '11',
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 3600,
        activityId: '3',
        activityName: 'Dev',
        comment: 'hello',
        remoteUserId: '7',
      },
    ]);
    expect(page.nextOffset).toBe(REDMINE_TIME_LOGS_PAGE_SIZE);
    expect(page.totalCount).toBe(150);

    const url = new URL(transport.requests[0]!.url);
    expect(url.origin + url.pathname).toBe('https://rm.example.com/time_entries.json');
    expect(url.searchParams.get('spent_on')).toBe('2026-03-15');
    expect(url.searchParams.get('user_id')).toBe('7');
    expect(url.searchParams.get('issue_id')).toBe('42,43');
    expect(url.searchParams.get('offset')).toBe('0');
    expect(url.searchParams.get('limit')).toBe(String(REDMINE_TIME_LOGS_PAGE_SIZE));
  });

  it('returns a null next offset when the page covers the total', async () => {
    const transport = fakeTransport([
      {
        status: 200,
        payload: {
          time_entries: [
            {
              id: 1,
              spent_on: '2026-03-15',
              hours: '0.5',
              issue: { id: 42 },
            },
          ],
          total_count: 1,
        },
      },
    ]);
    const client = new RedmineClient(transport, 'https://rm.example.com');

    const page = await client.fetchTimeLogsPage({ spentOn: '2026-03-15', issueIds: ['42'] }, null);

    expect(page.logs[0]!.durationSeconds).toBe(1800);
    expect(page.nextOffset).toBeNull();
  });

  it('skips malformed time-entry elements rather than throwing', async () => {
    const transport = fakeTransport([
      {
        status: 200,
        payload: {
          time_entries: [
            null,
            { id: 1 }, // missing issue/spent_on/hours
            {
              id: 2,
              spent_on: '2026-03-15',
              hours: 1,
              issue: { id: 42 },
            },
          ],
          total_count: 2,
        },
      },
    ]);
    const client = new RedmineClient(transport, 'https://rm.example.com');

    const page = await client.fetchTimeLogsPage({ spentOn: '2026-03-15', issueIds: ['42'] }, null);

    expect(page.logs).toHaveLength(1);
    expect(page.logs[0]!.remoteLogId).toBe('2');
  });

  it('builds a create-time-entry request with decimal hours', async () => {
    const transport = fakeTransport([{ status: 201, payload: { time_entry: { id: 99 } } }]);
    const client = new RedmineClient(transport, 'https://rm.example.com/');

    const { result } = await client.createTimeEntry(
      {
        remoteIssueId: '42',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityId: '5',
        comment: 'shipped',
      },
      'secret',
    );

    expect(result).toEqual({ remoteLogId: '99' });
    const request = transport.requests[0]!;
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://rm.example.com/time_entries.json');
    expect(request.headers?.['X-Redmine-API-Key']).toBe('secret');
    expect(request.body).toEqual({
      time_entry: {
        issue_id: 42,
        spent_on: '2026-03-15',
        hours: 0.5,
        activity_id: 5,
        comments: 'shipped',
      },
    });
  });
});
