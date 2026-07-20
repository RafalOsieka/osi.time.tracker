import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';

const secretStore = new Map<string, string>();

vi.mock('../../app/composables/useRemoteConfigSecret', () => ({
  useRemoteConfigSecret: () => ({
    get: (configId: string) => secretStore.get(configId) ?? null,
    set: (configId: string, secret: string) => secretStore.set(configId, secret),
    clear: (configId: string) => secretStore.delete(configId),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- imported after the mock is registered.
let useRemoteIssueSearch: any;

const config: RemoteSystemConfigDto = {
  id: 'config-1',
  clientId: 'client-1',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  executionMode: 'client',
  roundingRule: 'none',
  requiredFieldDefaults: {},
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('useRemoteIssueSearch', () => {
  beforeEach(async () => {
    secretStore.clear();
    secretStore.set(config.id, 'secret-api-key');
    vi.stubGlobal('fetch', vi.fn());
    ({ useRemoteIssueSearch } = await import('../../app/composables/useRemoteIssueSearch'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('does not call fetch for a too-short title', async () => {
    const { search, errorKey, results } = useRemoteIssueSearch(config);
    await search({ mode: 'title', query: 'ab' });
    expect(fetch).not.toHaveBeenCalled();
    expect(errorKey.value).toBe('error.remoteIssueSearchTitleTooShort');
    expect(results.value).toEqual([]);
  });

  it('does not call fetch for an empty id', async () => {
    const { search, errorKey } = useRemoteIssueSearch(config);
    await search({ mode: 'id', query: '   ' });
    expect(fetch).not.toHaveBeenCalled();
    expect(errorKey.value).toBe('error.remoteIssueSearchIdInvalid');
  });

  it('builds a title-search request with a Basic apikey Authorization header', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ _embedded: { elements: [{ id: 1, subject: 'Fix bug' }] } }) as never,
    );
    const { search, results } = useRemoteIssueSearch(config);
    await search({ mode: 'title', query: 'Fix bug' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('https://op.example.com/api/v3/work_packages?');
    const expectedAuth = `Basic ${Buffer.from('apikey:secret-api-key', 'utf-8').toString('base64')}`;
    expect((init as RequestInit).headers).toMatchObject({ Authorization: expectedAuth });
    expect(results.value).toEqual([{ remoteIssueId: '1', title: 'Fix bug' }]);
  });

  it('builds an exact-id lookup request', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: 42, subject: 'Some issue' }) as never);
    const { search, results } = useRemoteIssueSearch(config);
    await search({ mode: 'id', query: '42' });

    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe('https://op.example.com/api/v3/work_packages/42');
    expect(results.value).toEqual([{ remoteIssueId: '42', title: 'Some issue' }]);
  });

  it('maps a 404 id lookup to a not-found translated error', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 404) as never);
    const { search, results, errorKey } = useRemoteIssueSearch(config);
    await search({ mode: 'id', query: '999' });

    expect(results.value).toEqual([]);
    expect(errorKey.value).toBe('error.remoteIssueSearchNotFound');
  });

  it('maps a generic remote failure to a translated error key', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500) as never);
    const { search, errorKey } = useRemoteIssueSearch(config);
    await search({ mode: 'title', query: 'anything' });

    expect(errorKey.value).toBe('error.remoteIssueSearchFailed');
  });

  it('maps a network failure to a translated connection-failure key', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    const { search, errorKey } = useRemoteIssueSearch(config);
    await search({ mode: 'title', query: 'anything' });

    expect(errorKey.value).toBe('error.remoteServerModeConnectionFailed');
  });

  it('ignores a stale response that resolves after a newer request', async () => {
    let resolveFirst!: (value: unknown) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(fetch)
      .mockImplementationOnce(() => firstPromise as never)
      .mockImplementationOnce(
        async () =>
          jsonResponse({ _embedded: { elements: [{ id: 2, subject: 'Newer' }] } }) as never,
      );

    const { search, results } = useRemoteIssueSearch(config);
    const first = search({ mode: 'title', query: 'first query' });
    const second = search({ mode: 'title', query: 'second query' });

    await second;
    // Now resolve the stale first request; it must not overwrite the newer result.
    resolveFirst(jsonResponse({ _embedded: { elements: [{ id: 1, subject: 'Older' }] } }));
    await first;

    expect(results.value).toEqual([{ remoteIssueId: '2', title: 'Newer' }]);
  });

  it('never sends the credential to an OSI server API path', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ _embedded: { elements: [] } }) as never);
    const { search } = useRemoteIssueSearch(config);
    await search({ mode: 'title', query: 'anything' });

    for (const call of vi.mocked(fetch).mock.calls) {
      const [url, init] = call;
      if (String(url).startsWith('/api/')) {
        const headers = (init as RequestInit | undefined)?.headers as
          Record<string, string> | undefined;
        expect(headers?.Authorization).toBeUndefined();
      } else {
        expect(String(url)).toContain('op.example.com');
      }
    }
  });
});
