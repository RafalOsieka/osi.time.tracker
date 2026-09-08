import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export type FakeTrackerKind = 'openproject' | 'redmine';

export interface RecordedRequest {
  method: string;
  url: string;
}

export interface FakeTrackerServer {
  kind: FakeTrackerKind;
  origin: string;
  baseUrl: string;
  requests: RecordedRequest[];
  close: () => Promise<void>;
}

function readUrl(request: IncomingMessage): string {
  return request.url ?? '/';
}

function sendJson(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(body);
}

function handleOpenProject(request: IncomingMessage, response: ServerResponse): void {
  const url = readUrl(request);
  if (request.method === 'GET' && (url === '/' || url.startsWith('/api/v3'))) {
    sendJson(response, 200, JSON.stringify({ _type: 'Root', instanceName: 'fake-openproject' }));
    return;
  }
  sendJson(response, 404, JSON.stringify({ _type: 'Error' }));
}

function handleRedmine(request: IncomingMessage, response: ServerResponse): void {
  const url = readUrl(request);
  if (request.method === 'GET' && url.startsWith('/users/current')) {
    sendJson(response, 200, JSON.stringify({ user: { id: 1, login: 'ada' } }));
    return;
  }
  sendJson(response, 404, JSON.stringify({ errors: ['not found'] }));
}

function listen(
  kind: FakeTrackerKind,
  handler: typeof handleOpenProject,
): Promise<FakeTrackerServer> {
  const requests: RecordedRequest[] = [];
  const server: Server = createServer((request, response) => {
    requests.push({ method: request.method ?? 'GET', url: readUrl(request) });
    handler(request, response);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('fake tracker missing port'));
        return;
      }
      const origin = `http://127.0.0.1:${address.port}`;
      resolve({
        kind,
        origin,
        baseUrl: origin,
        requests,
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

export function startFakeOpenProject(): Promise<FakeTrackerServer> {
  return listen('openproject', handleOpenProject);
}

export function startFakeRedmine(): Promise<FakeTrackerServer> {
  return listen('redmine', handleRedmine);
}
