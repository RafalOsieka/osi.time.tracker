import { describe, expect, it } from 'vitest';
import {
  OpenProjectClient,
  OPENPROJECT_TITLE_SEARCH_MAX_RESULTS,
} from '../../shared/remote/openproject/client';
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

describe('OpenProjectClient', () => {
  it('builds a title-search request with the secret attached and a bounded page size', async () => {
    const transport = fakeTransport([
      { status: 200, payload: { _embedded: { elements: [{ id: 1, subject: 'Fix bug' }] } } },
    ]);
    const client = new OpenProjectClient(transport, 'https://op.example.com/');

    const { status, results } = await client.searchByTitle('Fix bug', 'secret-api-key');

    expect(status).toBe(200);
    expect(results).toEqual([{ remoteIssueId: '1', title: 'Fix bug' }]);
    const request = transport.requests[0]!;
    expect(request.method).toBe('GET');
    expect(request.headers?.Authorization).toBe(
      `Basic ${Buffer.from('apikey:secret-api-key', 'utf-8').toString('base64')}`,
    );
    const url = new URL(request.url);
    expect(url.origin + url.pathname).toBe('https://op.example.com/api/v3/work_packages');
    expect(url.searchParams.get('pageSize')).toBe(String(OPENPROJECT_TITLE_SEARCH_MAX_RESULTS));
    const filters = JSON.parse(url.searchParams.get('filters')!);
    expect(filters).toEqual([{ subject: { operator: '~', values: ['Fix bug'] } }]);
  });

  it('builds an exact-id lookup request and returns null for a 404 status', async () => {
    const transport = fakeTransport([{ status: 404, payload: {} }]);
    const client = new OpenProjectClient(transport, 'https://op.example.com');

    const { status, result } = await client.getIssueById('42', null);

    expect(status).toBe(404);
    expect(result).toBeNull();
    expect(transport.requests[0]!.url).toBe('https://op.example.com/api/v3/work_packages/42');
  });

  it('builds the project-scoped activities POST request keyed by the work package', async () => {
    const transport = fakeTransport([
      {
        status: 200,
        payload: {
          _embedded: {
            schema: {
              activity: { _embedded: { allowedValues: [{ id: 1, name: 'Development' }] } },
            },
          },
        },
      },
    ]);
    const client = new OpenProjectClient(transport, 'https://op.example.com');

    const { options } = await client.getActivityOptions('42', 'secret');

    expect(options).toEqual([{ id: '1', name: 'Development' }]);
    const request = transport.requests[0]!;
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://op.example.com/api/v3/time_entries/form');
    expect(request.body).toEqual({
      _links: { workPackage: { href: '/api/v3/work_packages/42' } },
    });
  });

  it('resolves the current account from /api/v3/users/me', async () => {
    const transport = fakeTransport([{ status: 200, payload: { id: 7, name: 'Ada' } }]);
    const client = new OpenProjectClient(transport, 'https://op.example.com');

    const { account } = await client.getCurrentAccount('secret');

    expect(account).toEqual({ id: '7', name: 'Ada' });
    expect(transport.requests[0]!.url).toBe('https://op.example.com/api/v3/users/me');
  });

  it('follows an absolute next-page URL rather than rebuilding filters', async () => {
    const transport = fakeTransport([{ status: 200, payload: {} }]);
    const client = new OpenProjectClient(transport, 'https://op.example.com');

    await client.fetchTimeLogsPage(
      {
        spentOn: '2026-03-15',
        workPackageIds: ['42'],
        nextPageUrl: 'https://op.example.com/api/v3/time_entries?offset=2',
      },
      null,
    );

    expect(transport.requests[0]!.url).toBe('https://op.example.com/api/v3/time_entries?offset=2');
  });

  it('parses a paginated time-log page and exposes the next-page URL', async () => {
    const transport = fakeTransport([
      {
        status: 200,
        payload: {
          _embedded: {
            elements: [
              {
                id: 11,
                spentOn: '2026-03-15',
                hours: 'PT1H',
                comment: { raw: 'hello' },
                _links: {
                  entity: { href: '/api/v3/work_packages/42' },
                  activity: { href: '/api/v3/time_entries/activities/3', title: 'Dev' },
                  user: { href: '/api/v3/users/7' },
                },
              },
            ],
          },
          _links: { next: { href: 'https://op.example.com/api/v3/time_entries?offset=2' } },
        },
      },
    ]);
    const client = new OpenProjectClient(transport, 'https://op.example.com');

    const page = await client.fetchTimeLogsPage(
      { spentOn: '2026-03-15', workPackageIds: ['42'] },
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
    expect(page.nextPageUrl).toBe('https://op.example.com/api/v3/time_entries?offset=2');
  });

  it('builds a create-time-entry request and parses the remote log id', async () => {
    const transport = fakeTransport([{ status: 201, payload: { id: 99 } }]);
    const client = new OpenProjectClient(transport, 'https://op.example.com/');

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
    expect(request.url).toBe('https://op.example.com/api/v3/time_entries');
    expect(request.headers?.Authorization).toBe(
      `Basic ${Buffer.from('apikey:secret', 'utf-8').toString('base64')}`,
    );
    expect(request.body).toEqual({
      spentOn: '2026-03-15',
      hours: 'PT30M',
      comment: { raw: 'shipped' },
      _links: {
        entity: { href: '/api/v3/work_packages/42' },
        activity: { href: '/api/v3/time_entries/activities/5' },
      },
    });
  });
});
