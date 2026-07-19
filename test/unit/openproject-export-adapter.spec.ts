import { describe, expect, it } from 'vitest';
import {
  buildCreateTimeEntryRequest,
  buildCurrentAccountRequest,
  buildTimeLogsRequest,
  formatOpenProjectDuration,
  parseCreateTimeEntryResult,
  parseCurrentAccountResult,
  parseOpenProjectDuration,
  parseTimeLogsPage,
} from '../../shared/utils/openproject-adapter';

describe('openproject export adapter', () => {
  it('builds the current-account request', () => {
    expect(buildCurrentAccountRequest('https://op.example.com/')).toEqual({
      url: 'https://op.example.com/api/v3/users/me',
      method: 'GET',
    });
  });

  it('parses the current account and rejects malformed payloads', () => {
    expect(parseCurrentAccountResult({ id: 7, name: 'Ada' })).toEqual({
      id: '7',
      name: 'Ada',
    });
    expect(parseCurrentAccountResult({ id: 7 })).toBeNull();
    expect(parseCurrentAccountResult(null)).toBeNull();
  });

  it('serializes and parses OpenProject durations', () => {
    expect(formatOpenProjectDuration(0)).toBe('PT0S');
    expect(formatOpenProjectDuration(45)).toBe('PT45S');
    expect(formatOpenProjectDuration(90)).toBe('PT1M30S');
    expect(formatOpenProjectDuration(3600 + 30 * 60)).toBe('PT1H30M');
    expect(parseOpenProjectDuration('PT1H30M')).toBe(5400);
    expect(parseOpenProjectDuration('PT45M')).toBe(2700);
    expect(parseOpenProjectDuration('PT90S')).toBe(90);
    expect(parseOpenProjectDuration('1:30')).toBeNull();
  });

  it('builds filtered time-log requests and follows next-page URLs', () => {
    const request = buildTimeLogsRequest({
      baseUrl: 'https://op.example.com',
      spentOn: '2026-03-15',
      workPackageIds: ['42', '43'],
      userId: '7',
    });
    expect(request.method).toBe('GET');
    const url = new URL(request.url);
    expect(url.origin + url.pathname).toBe('https://op.example.com/api/v3/time_entries');
    const filters = JSON.parse(url.searchParams.get('filters')!);
    expect(filters).toEqual(
      expect.arrayContaining([
        { spent_on: { operator: '=d', values: ['2026-03-15'] } },
        { entity_type: { operator: '=', values: ['WorkPackage'] } },
        { entity_id: { operator: '=', values: ['42', '43'] } },
        { user_id: { operator: '=', values: ['7'] } },
      ]),
    );

    const next = buildTimeLogsRequest({
      baseUrl: 'https://op.example.com',
      spentOn: '2026-03-15',
      workPackageIds: ['42'],
      nextPageUrl: 'https://op.example.com/api/v3/time_entries?offset=2',
    });
    expect(next.url).toBe('https://op.example.com/api/v3/time_entries?offset=2');
  });

  it('parses paginated time-log HAL collections and skips malformed rows', () => {
    const page = parseTimeLogsPage({
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
          {
            id: 13,
            spentOn: '2026-03-15',
            hours: 'PT30M',
            _links: {
              // Older OpenProject payloads still expose workPackage.
              workPackage: { href: '/api/v3/work_packages/43' },
              activity: { href: '/api/v3/time_entries/activities/1', title: 'Mgmt' },
              user: { href: '/api/v3/users/7' },
            },
          },
          { id: 12, hours: 'nope' },
        ],
      },
      _links: { next: { href: 'https://op.example.com/api/v3/time_entries?offset=2' } },
    });

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
      {
        remoteLogId: '13',
        remoteIssueId: '43',
        spentOn: '2026-03-15',
        durationSeconds: 1800,
        activityId: '1',
        activityName: 'Mgmt',
        comment: null,
        remoteUserId: '7',
      },
    ]);
    expect(page.nextPageUrl).toBe('https://op.example.com/api/v3/time_entries?offset=2');
    expect(parseTimeLogsPage({})).toEqual({ logs: [], nextPageUrl: null });
  });

  it('builds create-time-entry requests and parses the remote log id', () => {
    const request = buildCreateTimeEntryRequest({
      baseUrl: 'https://op.example.com/',
      remoteIssueId: '42',
      spentOn: '2026-03-15',
      durationSeconds: 1800,
      activityId: '5',
      comment: 'shipped',
    });
    expect(request).toEqual({
      url: 'https://op.example.com/api/v3/time_entries',
      method: 'POST',
      body: {
        spentOn: '2026-03-15',
        hours: 'PT30M',
        comment: { raw: 'shipped' },
        _links: {
          entity: { href: '/api/v3/work_packages/42' },
          activity: { href: '/api/v3/time_entries/activities/5' },
        },
      },
    });
    expect(parseCreateTimeEntryResult({ id: 99 })).toEqual({ remoteLogId: '99' });
    expect(
      parseCreateTimeEntryResult({ _links: { self: { href: '/api/v3/time_entries/100' } } }),
    ).toEqual({ remoteLogId: '100' });
    expect(parseCreateTimeEntryResult({})).toBeNull();
  });

  it('maps remote API error payloads without throwing during parse', () => {
    expect(parseTimeLogsPage({ _type: 'Error', message: 'boom' })).toEqual({
      logs: [],
      nextPageUrl: null,
    });
    expect(parseCreateTimeEntryResult({ _type: 'Error' })).toBeNull();
  });
});
