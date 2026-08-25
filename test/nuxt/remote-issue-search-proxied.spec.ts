import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRemoteIssueSearch } from '../../app/composables/useRemoteIssueSearch';
import { REMOTE_SECRET_HEADER } from '../../shared/config/remote-secret';

const csrfFetchMock = vi.hoisted(() => vi.fn());

// oxlint-disable-next-line anti-slop/no-module-mocking -- `$fetch`/`ofetch` is a Nuxt global without a project DI port
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

// oxlint-disable-next-line anti-slop/no-module-mocking -- cookie secret composable has no test seam
vi.mock('../../app/composables/useTrackerSecret', () => ({
  useTrackerSecret: () => ({
    get: (trackerId: string) => secretStore.get(trackerId) ?? null,
    set: (trackerId: string, secret: string) => secretStore.set(trackerId, secret),
    clear: (trackerId: string) => secretStore.delete(trackerId),
  }),
}));

const config = {
  id: 'config-1',
  name: 'Tracker 1',
  systemType: 'openproject' as const,
  baseUrl: 'https://op.example.com',
  executionMode: 'server' as const,
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
    expect(init.headers[REMOTE_SECRET_HEADER]).toBe('browser-held-secret');
    expect(init.body).toEqual({
      trackerId: 'config-1',
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
    expect(errorKey.value).toBe('error.remoteServerModeSecretRequired');
    expect(results.value).toEqual([]);
  });

  it('maps a server-mapped error messageKey from the server-execution endpoint', async () => {
    const err = new Error('auth rejected');
    Object.assign(err, {
      data: { data: { messageKey: 'error.remoteServerModeAuthRejected' } },
    });
    csrfFetchMock.mockRejectedValue(err);
    const { search, errorKey } = useRemoteIssueSearch(config);

    await search({ mode: 'title', query: 'login bug' });

    expect(errorKey.value).toBe('error.remoteServerModeAuthRejected');
  });
});
