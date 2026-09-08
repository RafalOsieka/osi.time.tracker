import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { JsonValue } from '@osi/remote-trackers/contracts';

export type FakeTrackerKind = 'openproject' | 'redmine';

export interface RecordedRequest {
  method: string;
  url: string;
  authorization?: string;
}

export interface FakeTrackerServer {
  kind: FakeTrackerKind;
  origin: string;
  baseUrl: string;
  requests: RecordedRequest[];
  createdLogIds: number[];
  close: () => Promise<void>;
}

interface FakeTrackerOptions {
  dropCreateResponse?: boolean;
  nextPageUrl?: string;
  redirectAccountTo?: string;
}

function readUrl(request: IncomingMessage): string {
  return request.url ?? '/';
}

function sendJson(response: ServerResponse, status: number, body: JsonValue): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

function sendRedirect(response: ServerResponse, location: string): void {
  response.writeHead(302, { location });
  response.end();
}

function handleOpenProject(request: IncomingMessage, response: ServerResponse): void {
  const url = readUrl(request);
  if (url.startsWith('/redirect')) {
    sendRedirect(response, 'http://evil.example/stolen');
    return;
  }
  if (request.method === 'GET' && url.startsWith('/api/v3/users/me')) {
    sendJson(response, 200, { id: 7, name: 'Ada' });
    return;
  }
  if (
    request.method === 'GET' &&
    /^\/api\/v3\/work_packages\/[^/?]+$/.test(url.split('?')[0] ?? '')
  ) {
    sendJson(response, 200, {
      id: 42,
      subject: 'Ship it',
      _links: { project: { title: 'P' } },
    });
    return;
  }
  if (request.method === 'GET' && url.startsWith('/api/v3/work_packages')) {
    sendJson(response, 200, {
      _embedded: {
        elements: [{ id: 42, subject: 'Ship it', _links: { project: { title: 'P' } } }],
      },
    });
    return;
  }
  if (request.method === 'POST' && url.startsWith('/api/v3/time_entries/form')) {
    sendJson(response, 200, {
      _embedded: {
        schema: {
          activity: {
            _embedded: { allowedValues: [{ id: 1, name: 'Development' }] },
          },
        },
      },
    });
    return;
  }
  if (request.method === 'GET' && url.startsWith('/api/v3/time_entries')) {
    sendJson(response, 200, {
      _embedded: {
        elements: [
          {
            id: 9001,
            spentOn: '2026-03-15',
            hours: 'PT30M',
            _links: {
              self: { href: '/api/v3/time_entries/9001' },
              entity: { href: '/api/v3/work_packages/42' },
              activity: { href: '/api/v3/time_entries/activities/1', title: 'Development' },
              user: { href: '/api/v3/users/7' },
            },
          },
        ],
      },
    });
    return;
  }
  if (request.method === 'POST' && url.startsWith('/api/v3/time_entries')) {
    sendJson(response, 201, { id: 9001 });
    return;
  }
  if (request.method === 'GET' && (url === '/' || url.startsWith('/api/v3'))) {
    sendJson(response, 200, { _type: 'Root', instanceName: 'fake-openproject' });
    return;
  }
  sendJson(response, 404, { _type: 'Error' });
}

function handleRedmine(request: IncomingMessage, response: ServerResponse): void {
  const url = readUrl(request);
  if (url.startsWith('/redirect')) {
    sendRedirect(response, 'http://evil.example/stolen');
    return;
  }
  if (request.method === 'GET' && url.startsWith('/users/current')) {
    sendJson(response, 200, {
      user: { id: 7, firstname: 'Ada', lastname: 'Lovelace', login: 'ada' },
    });
    return;
  }
  if (request.method === 'GET' && /^\/issues\/[^/.]+\.json/.test(url)) {
    sendJson(response, 200, { issue: { id: 42, subject: 'Ship it', project: { name: 'P' } } });
    return;
  }
  if (request.method === 'GET' && url.startsWith('/issues.json')) {
    sendJson(response, 200, {
      issues: [{ id: 42, subject: 'Ship it', project: { name: 'P' } }],
    });
    return;
  }
  if (request.method === 'GET' && url.startsWith('/enumerations/time_entry_activities')) {
    sendJson(response, 200, {
      time_entry_activities: [{ id: 1, name: 'Development', active: true }],
    });
    return;
  }
  if (request.method === 'GET' && url.startsWith('/time_entries.json')) {
    sendJson(response, 200, {
      time_entries: [
        {
          id: 9001,
          spent_on: '2026-03-15',
          hours: 0.5,
          issue: { id: 42 },
          activity: { id: 1, name: 'Development' },
          user: { id: 7 },
        },
      ],
      total_count: 1,
    });
    return;
  }
  if (request.method === 'POST' && url.startsWith('/time_entries.json')) {
    sendJson(response, 201, { time_entry: { id: 9001 } });
    return;
  }
  sendJson(response, 404, { errors: ['not found'] });
}

function listen(
  kind: FakeTrackerKind,
  handler: typeof handleOpenProject,
  options: FakeTrackerOptions,
): Promise<FakeTrackerServer> {
  const requests: RecordedRequest[] = [];
  const createdLogIds: number[] = [];
  const server: Server = createServer((request, response) => {
    requests.push({
      method: request.method ?? 'GET',
      url: readUrl(request),
      authorization: request.headers.authorization,
    });
    const path = readUrl(request).split('?')[0];
    if (
      request.method === 'POST' &&
      (path === '/api/v3/time_entries' || path === '/time_entries.json')
    ) {
      createdLogIds.push(9001 + createdLogIds.length);
      if (options.dropCreateResponse) {
        response.destroy();
        return;
      }
    }
    if (options.nextPageUrl && path === '/api/v3/time_entries' && request.method === 'GET') {
      sendJson(response, 200, {
        _embedded: { elements: [] },
        _links: { next: { href: options.nextPageUrl } },
      });
      return;
    }
    if (options.redirectAccountTo && path === '/api/v3/users/me') {
      sendRedirect(response, options.redirectAccountTo);
      return;
    }
    handler(request, response);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || !('port' in address)) {
        reject(new Error('fake tracker missing port'));
        return;
      }
      const origin = `http://127.0.0.1:${address.port}`;
      resolve({
        kind,
        origin,
        baseUrl: origin,
        requests,
        createdLogIds,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) closeReject(error);
              else closeResolve();
            });
          }),
      });
    });
  });
}

export function startFakeOpenProject(options: FakeTrackerOptions = {}): Promise<FakeTrackerServer> {
  return listen('openproject', handleOpenProject, options);
}

export function startFakeRedmine(options: FakeTrackerOptions = {}): Promise<FakeTrackerServer> {
  return listen('redmine', handleRedmine, options);
}
