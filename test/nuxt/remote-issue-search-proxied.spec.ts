import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRemoteIssueSearch } from '../../app/composables/useRemoteIssueSearch';
import { REMOTE_PROXY_SECRET_HEADER } from '../../shared/config/remote-proxy';

const csrfFetchMock = vi.fn();

vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return {
    ...actual,
    $fetch: Object.assign(csrfFetchMock, {
      create: () => csrfFetchMock,
      raw: csrfFetchMock,
      native: csrfFetchMock,
    }),
  };
});

const secretStore = new Map<string, string>();

vi.mock('../../app/composables/useRemoteConfigSecret', () => ({
  useRemoteConfigSecret: () => ({
    get: (configId: string) => secretStore.get(configId) ?? null,
    set: (configId: string, secret: string) => secretStore.set(configId, secret),
    clear: (configId: string) => secretStore.delete(configId),
  }),
}));

const config = {
  id: 'config-1',
  clientId: 'client-1',
  systemType: 'openproject' as const,
  baseUrl: 'https://op.example.com',
  executionMode: 'client' as const,
  transportMode: 'proxied' as const,
  roundingRule: 'none' as const,
  requiredFieldDefaults: {},
  createdAt: '',
  updatedAt: '',
};

describe('useRemoteIssueSearch (proxied transport)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    secretStore.clear();
    secretStore.set(config.id, 'browser-held-secret');
    csrfFetchMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('routes the search through the OSI proxy route and forwards the secret header', async () => {
    csrfFetchMock.mockResolvedValue({ results: [{ remoteIssueId: '1', title: 'Fix login bug' }] });
    const { search, results } = useRemoteIssueSearch(config);

    await search({ mode: 'title', query: 'login bug' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(csrfFetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = csrfFetchMock.mock.calls[0]!;
    expect(requestUrl).toBe('/api/remote/search');
    expect(init.method).toBe('POST');
    expect(init.headers[REMOTE_PROXY_SECRET_HEADER]).toBe('browser-held-secret');
    expect(init.body).toEqual({
      remoteSystemConfigId: 'config-1',
      mode: 'title',
      query: 'login bug',
    });
    expect(results.value).toEqual([{ remoteIssueId: '1', title: 'Fix login bug' }]);
  });

  it('does not contact the server when no secret is stored for this configuration', async () => {
    secretStore.clear();
    const { search, errorKey, results } = useRemoteIssueSearch(config);

    await search({ mode: 'title', query: 'login bug' });

    expect(csrfFetchMock).not.toHaveBeenCalled();
    expect(errorKey.value).toBe('error.remoteProxySecretRequired');
    expect(results.value).toEqual([]);
  });

  it('maps a server-mapped error messageKey from the proxy route', async () => {
    csrfFetchMock.mockRejectedValue({
      data: { data: { messageKey: 'error.remoteProxyAuthRejected' } },
    });
    const { search, errorKey } = useRemoteIssueSearch(config);

    await search({ mode: 'title', query: 'login bug' });

    expect(errorKey.value).toBe('error.remoteProxyAuthRejected');
  });
});
