import { describe, expect, it } from 'vitest';
import {
  OPENPROJECT_TITLE_SEARCH_MAX_RESULTS,
  buildIssueByIdRequest,
  buildTitleSearchRequest,
  deriveIssueUrl,
  normalizeBaseUrl,
  parseIssueByIdResult,
  parseTitleSearchResults,
} from '../../shared/utils/openproject-adapter';

describe('normalizeBaseUrl', () => {
  it('removes a single trailing slash', () => {
    expect(normalizeBaseUrl('https://op.example.com/')).toBe('https://op.example.com');
  });

  it('removes multiple trailing slashes', () => {
    expect(normalizeBaseUrl('https://op.example.com///')).toBe('https://op.example.com');
  });

  it('leaves a URL without a trailing slash unchanged', () => {
    expect(normalizeBaseUrl('https://op.example.com')).toBe('https://op.example.com');
  });
});

describe('buildTitleSearchRequest', () => {
  it('encodes the title as a JSON filters query param without a status restriction', () => {
    const request = buildTitleSearchRequest('https://op.example.com/', 'Fix login bug');
    const parsedUrl = new URL(request.url);
    expect(parsedUrl.origin + parsedUrl.pathname).toBe(
      'https://op.example.com/api/v3/work_packages',
    );
    const filters = JSON.parse(parsedUrl.searchParams.get('filters')!);
    expect(filters).toEqual([{ subject: { operator: '~', values: ['Fix login bug'] } }]);
    expect(filters[0].status).toBeUndefined();
    expect(request.method).toBe('GET');
  });

  it('bounds the requested pageSize to the fixed maximum', () => {
    const request = buildTitleSearchRequest('https://op.example.com', 'anything');
    const parsedUrl = new URL(request.url);
    expect(parsedUrl.searchParams.get('pageSize')).toBe(
      String(OPENPROJECT_TITLE_SEARCH_MAX_RESULTS),
    );
  });

  it('avoids a duplicated slash when the base URL already ends with one', () => {
    const request = buildTitleSearchRequest('https://op.example.com/', 'x');
    expect(request.url.startsWith('https://op.example.com/api/v3/work_packages')).toBe(true);
    expect(request.url).not.toContain('//api');
  });
});

describe('buildIssueByIdRequest', () => {
  it('builds an exact-ID lookup request', () => {
    const request = buildIssueByIdRequest('https://op.example.com', '42');
    expect(request.url).toBe('https://op.example.com/api/v3/work_packages/42');
    expect(request.method).toBe('GET');
  });

  it('URL-encodes the id and normalizes a trailing slash on the base URL', () => {
    const request = buildIssueByIdRequest('https://op.example.com/', 'a b');
    expect(request.url).toBe('https://op.example.com/api/v3/work_packages/a%20b');
  });
});

describe('deriveIssueUrl', () => {
  it('derives a browsable work-package URL without a duplicated slash', () => {
    expect(deriveIssueUrl('https://op.example.com/', '42')).toBe(
      'https://op.example.com/work_packages/42',
    );
  });
});

describe('parseTitleSearchResults', () => {
  function makeElements(count: number) {
    return Array.from({ length: count }, (_, i) => ({ id: i + 1, subject: `Issue ${i + 1}` }));
  }

  it('parses a well-formed collection payload', () => {
    const payload = { _embedded: { elements: makeElements(3) } };
    expect(parseTitleSearchResults(payload)).toEqual([
      { remoteIssueId: '1', title: 'Issue 1' },
      { remoteIssueId: '2', title: 'Issue 2' },
      { remoteIssueId: '3', title: 'Issue 3' },
    ]);
  });

  it('caps the result list at the fixed maximum even when the backend returns more', () => {
    const payload = { _embedded: { elements: makeElements(100) } };
    const results = parseTitleSearchResults(payload);
    expect(results).toHaveLength(OPENPROJECT_TITLE_SEARCH_MAX_RESULTS);
    expect(results[0]).toEqual({ remoteIssueId: '1', title: 'Issue 1' });
  });

  it('returns an empty array when _embedded is missing', () => {
    expect(parseTitleSearchResults({})).toEqual([]);
  });

  it('returns an empty array when elements is not an array', () => {
    expect(parseTitleSearchResults({ _embedded: { elements: 'nope' } })).toEqual([]);
  });

  it('skips elements missing a subject or id rather than throwing', () => {
    const payload = {
      _embedded: {
        elements: [
          { id: 1, subject: 'Valid' },
          { id: 2 },
          { subject: 'No id' },
          null,
          'not-an-object',
        ],
      },
    };
    expect(parseTitleSearchResults(payload)).toEqual([{ remoteIssueId: '1', title: 'Valid' }]);
  });

  it('returns an empty array for a completely malformed payload', () => {
    expect(parseTitleSearchResults(null)).toEqual([]);
    expect(parseTitleSearchResults(undefined)).toEqual([]);
    expect(parseTitleSearchResults('garbage')).toEqual([]);
  });
});

describe('parseIssueByIdResult', () => {
  it('parses a well-formed single work-package payload', () => {
    const result = parseIssueByIdResult({ id: 42, subject: 'Some Issue' }, 200);
    expect(result).toEqual({ remoteIssueId: '42', title: 'Some Issue' });
  });

  it('returns null for a 404 status instead of throwing', () => {
    expect(parseIssueByIdResult({ error: 'not found' }, 404)).toBeNull();
  });

  it('returns null for a malformed payload regardless of status', () => {
    expect(parseIssueByIdResult(null, 200)).toBeNull();
    expect(parseIssueByIdResult({ subject: 'No id' }, 200)).toBeNull();
    expect(parseIssueByIdResult({ id: 42 }, 200)).toBeNull();
  });

  it('returns a result regardless of the work package status field', () => {
    const closed = parseIssueByIdResult(
      { id: 7, subject: 'Closed issue', status: { name: 'Closed' } },
      200,
    );
    expect(closed).toEqual({ remoteIssueId: '7', title: 'Closed issue' });
  });
});
