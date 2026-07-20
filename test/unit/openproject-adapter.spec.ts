import { describe, expect, it } from 'vitest';
import { OpenProjectAdapter } from '../../shared/remote/openproject/adapter';
import {
  RemoteAdapterError,
  type RemoteRequest,
  type RemoteResponse,
  type Transport,
} from '../../shared/types/remote-adapter';

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

describe('OpenProjectAdapter', () => {
  it('follows time-log pagination across pages until nextPageUrl is absent', async () => {
    let calls = 0;
    const transport = fakeTransport((request) => {
      calls += 1;
      if (!request.url.includes('offset=2')) {
        return {
          status: 200,
          payload: {
            _embedded: {
              elements: [
                {
                  id: 1,
                  spentOn: '2026-03-15',
                  hours: 'PT1H',
                  _links: { entity: { href: '/api/v3/work_packages/42' } },
                },
              ],
            },
            _links: { next: { href: 'https://op.example.com/api/v3/time_entries?offset=2' } },
          },
        };
      }
      return {
        status: 200,
        payload: {
          _embedded: {
            elements: [
              {
                id: 2,
                spentOn: '2026-03-15',
                hours: 'PT30M',
                _links: { entity: { href: '/api/v3/work_packages/42' } },
              },
            ],
          },
        },
      };
    });
    const adapter = new OpenProjectAdapter(transport, 'https://op.example.com', null);

    const logs = await adapter.fetchTimeLogs({ spentOn: '2026-03-15', workPackageIds: ['42'] });

    expect(calls).toBe(2);
    expect(logs.map((log) => log.remoteLogId)).toEqual(['1', '2']);
  });

  it('treats a 403 activities response as empty rather than a hard failure', async () => {
    const transport = fakeTransport(() => ({ status: 403, payload: {} }));
    const adapter = new OpenProjectAdapter(transport, 'https://op.example.com', 'secret');

    const options = await adapter.getActivityOptions('42');

    expect(options).toEqual([]);
  });

  it('resolves a 404 exact-id lookup to null rather than throwing', async () => {
    const transport = fakeTransport(() => ({ status: 404, payload: {} }));
    const adapter = new OpenProjectAdapter(transport, 'https://op.example.com', null);

    const result = await adapter.getIssueById('999');

    expect(result).toBeNull();
  });

  it('maps a rejected credential to a distinct auth-rejected messageKey', async () => {
    const transport = fakeTransport(() => ({ status: 401, payload: {} }));
    const adapter = new OpenProjectAdapter(transport, 'https://op.example.com', 'bad-secret');

    await expect(adapter.searchIssues('anything')).rejects.toMatchObject({
      messageKey: 'error.remoteServerModeAuthRejected',
    });
  });

  it('maps a generic upstream failure to the operation-specific messageKey', async () => {
    const transport = fakeTransport(() => ({ status: 500, payload: {} }));
    const adapter = new OpenProjectAdapter(transport, 'https://op.example.com', null);

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
    const adapter = new OpenProjectAdapter(transport, 'https://op.example.com', null);

    await expect(adapter.getCurrentAccount()).rejects.toBeInstanceOf(RemoteAdapterError);
    await expect(adapter.getCurrentAccount()).rejects.toMatchObject({
      messageKey: 'error.remoteServerModeConnectionFailed',
    });
  });

  it('creates a time entry and returns the remote log id', async () => {
    const transport = fakeTransport(() => ({ status: 201, payload: { id: 99 } }));
    const adapter = new OpenProjectAdapter(transport, 'https://op.example.com', 'secret');

    const result = await adapter.createTimeEntry({
      remoteIssueId: '42',
      spentOn: '2026-03-15',
      durationSeconds: 900,
      activityId: '5',
    });

    expect(result).toEqual({ remoteLogId: '99' });
  });
});
