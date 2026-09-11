import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackerDto } from '../../shared/types/tracker';
import type { JsonValue } from '@osi/remote-trackers/contracts';

const secretStore = new Map<string, string>();

// oxlint-disable-next-line anti-slop/no-module-mocking -- cookie secret composable has no test seam
vi.mock('../../app/composables/use-tracker-secret', () => ({
  useTrackerSecret: () => ({
    get: (trackerId: string) => secretStore.get(trackerId) ?? null,
    set: (trackerId: string, secret: string) => secretStore.set(trackerId, secret),
    clear: (trackerId: string) => secretStore.delete(trackerId),
  }),
}));

// oxlint-disable-next-line typescript/no-explicit-any -- imported after the mock is registered.
let useRemoteIssueSearch: any;

const config: TrackerDto = {
  id: 'config-1',
  name: 'Tracker 1',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  directBrowserAccess: true,
  roundingRule: 'none',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

function jsonResponse(body: JsonValue, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('useRemoteIssueSearch', () => {
  beforeEach(async () => {
    secretStore.clear();
    secretStore.set(config.id, 'secret-api-key');
    vi.stubGlobal('fetch', vi.fn());
    ({ useRemoteIssueSearch } = await import('../../app/composables/use-remote-issue-search'));
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
      jsonResponse({ _embedded: { elements: [{ id: 1, subject: 'Fix bug' }] } }),
    );
    const { search, results } = useRemoteIssueSearch(config);
    await search({ mode: 'title', query: 'Fix bug' });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('https://op.example.com/api/v3/work_packages?');
    const expectedAuth = `Basic ${Buffer.from('apikey:secret-api-key', 'utf-8').toString('base64')}`;
    const headers = new Request('https://example.invalid', init ?? undefined).headers;
    const authorization = headers instanceof Headers ? headers.get('Authorization') : undefined;
    expect(authorization).toBe(expectedAuth);
    expect(results.value).toEqual([{ remoteIssueId: '1', title: 'Fix bug' }]);
  });

  it('builds an exact-id lookup request', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: 42, subject: 'Some issue' }));
    const { search, results } = useRemoteIssueSearch(config);
    await search({ mode: 'id', query: '42' });

    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe('https://op.example.com/api/v3/work_packages/42');
    expect(results.value).toEqual([{ remoteIssueId: '42', title: 'Some issue' }]);
  });

  it('maps a 404 id lookup to a not-found translated error', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 404));
    const { search, results, errorKey } = useRemoteIssueSearch(config);
    await search({ mode: 'id', query: '999' });

    expect(results.value).toEqual([]);
    expect(errorKey.value).toBe('error.remoteIssueSearchNotFound');
  });

  it('forwards the scope to a scoped title search and marks no result out of scope', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ _embedded: { elements: [{ id: 1, subject: 'Fix bug' }] } }),
    );
    const { search, results, outOfScopeId } = useRemoteIssueSearch(config, () => ({
      remoteProjectId: '3',
    }));
    await search({ mode: 'title', query: 'Fix bug' });

    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('/api/v3/projects/3/work_packages?');
    expect(results.value).toEqual([{ remoteIssueId: '1', title: 'Fix bug' }]);
    expect(outOfScopeId.value).toBeNull();
  });

  it('does not scope the search when applyScope is false', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ _embedded: { elements: [] } }));
    const { search } = useRemoteIssueSearch(config, () => ({ remoteProjectId: '3' }));
    await search({ mode: 'title', query: 'Fix bug' }, false);

    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('/api/v3/work_packages?');
    expect(String(url)).not.toContain('/projects/3/');
  });

  it('marks an in-scope id-mode result without a hint', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ _embedded: { elements: [{ id: 38, subject: 'Child wp' }] } }),
    );
    const { search, results, outOfScopeId } = useRemoteIssueSearch(config, () => ({
      remoteProjectId: '3',
    }));
    await search({ mode: 'id', query: '38' });

    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('/api/v3/projects/3/work_packages?');
    expect(results.value).toEqual([{ remoteIssueId: '38', title: 'Child wp' }]);
    expect(outOfScopeId.value).toBeNull();
  });

  it('falls back to the direct lookup and flags an out-of-scope id result', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ _embedded: { elements: [] } }))
      .mockResolvedValueOnce(jsonResponse({ id: 39, subject: 'Unrelated wp' }));
    const { search, results, outOfScopeId, errorKey } = useRemoteIssueSearch(config, () => ({
      remoteProjectId: '3',
    }));
    await search({ mode: 'id', query: '39' });

    expect(fetch).toHaveBeenCalledTimes(2);
    const [firstUrl] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(firstUrl)).toContain('/api/v3/projects/3/work_packages?');
    const [secondUrl] = vi.mocked(fetch).mock.calls[1]!;
    expect(String(secondUrl)).toBe('https://op.example.com/api/v3/work_packages/39');
    expect(results.value).toEqual([{ remoteIssueId: '39', title: 'Unrelated wp' }]);
    expect(outOfScopeId.value).toBe('39');
    expect(errorKey.value).toBeNull();
  });

  it('resolves not-found when neither the scoped nor direct id lookup finds a result', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ _embedded: { elements: [] } }))
      .mockResolvedValueOnce(jsonResponse({}, 404));
    const { search, results, outOfScopeId, errorKey } = useRemoteIssueSearch(config, () => ({
      remoteProjectId: '3',
    }));
    await search({ mode: 'id', query: '999' });

    expect(results.value).toEqual([]);
    expect(outOfScopeId.value).toBeNull();
    expect(errorKey.value).toBe('error.remoteIssueSearchNotFound');
  });

  it('maps a generic remote failure to a translated error key', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, 500));
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
    let resolveFirst!: (value: Response) => void;
    const firstPromise = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    vi.mocked(fetch)
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(async () =>
        jsonResponse({ _embedded: { elements: [{ id: 2, subject: 'Newer' }] } }),
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

  it('suppresses a stale two-step id lookup superseded by a newer search', async () => {
    // Dispatch by request content rather than call order: the two searches'
    // fetches interleave at each `await` boundary, not strictly FIFO.
    let resolveDirectLookup!: (value: Response) => void;
    const directLookupPromise = new Promise<Response>((resolve) => {
      resolveDirectLookup = resolve;
    });
    vi.mocked(fetch).mockImplementation(async (input) => {
      const requestUrl = String(input);
      if (requestUrl === 'https://op.example.com/api/v3/work_packages/39') {
        return directLookupPromise; // direct-lookup fallback: hangs until resolved below
      }
      if (requestUrl.includes('/projects/3/work_packages') && requestUrl.includes('%2239%22')) {
        return jsonResponse({ _embedded: { elements: [] } }); // scoped id lookup: miss
      }
      return jsonResponse({ _embedded: { elements: [{ id: 2, subject: 'Newer' }] } }); // title search
    });

    const { search, results, outOfScopeId } = useRemoteIssueSearch(config, () => ({
      remoteProjectId: '3',
    }));
    const first = search({ mode: 'id', query: '39' });
    const second = search({ mode: 'title', query: 'newer query' });

    await second;
    expect(results.value).toEqual([{ remoteIssueId: '2', title: 'Newer' }]);

    // Now let the stale first request's direct lookup resolve; it must not
    // overwrite the newer title-search result or set an out-of-scope flag.
    resolveDirectLookup(jsonResponse({ id: 39, subject: 'Unrelated wp' }));
    await first;

    expect(results.value).toEqual([{ remoteIssueId: '2', title: 'Newer' }]);
    expect(outOfScopeId.value).toBeNull();
  });

  it('never sends the credential to an OSI server API path', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ _embedded: { elements: [] } }));
    const { search } = useRemoteIssueSearch(config);
    await search({ mode: 'title', query: 'anything' });

    for (const call of vi.mocked(fetch).mock.calls) {
      const [url, init] = call;
      if (String(url).startsWith('/api/')) {
        const authorization = new Request('https://example.invalid', init ?? undefined).headers.get(
          'Authorization',
        );
        expect(authorization).toBeUndefined();
      } else {
        expect(String(url)).toContain('op.example.com');
      }
    }
  });
});
