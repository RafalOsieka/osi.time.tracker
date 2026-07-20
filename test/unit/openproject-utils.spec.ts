import { describe, expect, it } from 'vitest';
import {
  formatOpenProjectDuration,
  hrefId,
  parseOpenProjectDuration,
} from '../../shared/remote/openproject/utils';
import { normalizeBaseUrl } from '../../shared/utils/normalize-base-url';
import { deriveIssueUrl } from '../../shared/remote/issue-url';

describe('normalizeBaseUrl', () => {
  it('strips a single trailing slash', () => {
    expect(normalizeBaseUrl('https://op.example.com/')).toBe('https://op.example.com');
  });

  it('strips multiple trailing slashes', () => {
    expect(normalizeBaseUrl('https://op.example.com///')).toBe('https://op.example.com');
  });

  it('leaves a URL without a trailing slash unchanged', () => {
    expect(normalizeBaseUrl('https://op.example.com')).toBe('https://op.example.com');
  });
});

describe('deriveIssueUrl', () => {
  it('joins the normalized OpenProject base URL with the encoded issue id', () => {
    expect(deriveIssueUrl('openproject', 'https://op.example.com/', '42')).toBe(
      'https://op.example.com/work_packages/42',
    );
  });

  it('encodes special characters in the OpenProject issue id', () => {
    expect(deriveIssueUrl('openproject', 'https://op.example.com', '42/../secret')).toBe(
      'https://op.example.com/work_packages/42%2F..%2Fsecret',
    );
  });

  it('joins the normalized Redmine base URL with the encoded issue id', () => {
    expect(deriveIssueUrl('redmine', 'https://rm.example.com/', '42')).toBe(
      'https://rm.example.com/issues/42',
    );
  });
});

describe('formatOpenProjectDuration', () => {
  it('formats hours, minutes, and seconds together', () => {
    expect(formatOpenProjectDuration(5445)).toBe('PT1H30M45S');
  });

  it('formats whole hours without minutes or seconds', () => {
    expect(formatOpenProjectDuration(3600)).toBe('PT1H');
  });

  it('formats whole minutes without hours or seconds', () => {
    expect(formatOpenProjectDuration(1800)).toBe('PT30M');
  });

  it('formats sub-minute durations as seconds', () => {
    expect(formatOpenProjectDuration(45)).toBe('PT45S');
  });

  it('rounds down fractional seconds', () => {
    expect(formatOpenProjectDuration(90.9)).toBe('PT1M30S');
  });

  it('formats zero as PT0S', () => {
    expect(formatOpenProjectDuration(0)).toBe('PT0S');
  });

  it('clamps negative durations to PT0S', () => {
    expect(formatOpenProjectDuration(-100)).toBe('PT0S');
  });
});

describe('parseOpenProjectDuration', () => {
  it('parses a duration with hours, minutes, and seconds', () => {
    expect(parseOpenProjectDuration('PT1H30M45S')).toBe(5445);
  });

  it('parses an hours-only duration', () => {
    expect(parseOpenProjectDuration('PT1H')).toBe(3600);
  });

  it('parses a minutes-only duration', () => {
    expect(parseOpenProjectDuration('PT30M')).toBe(1800);
  });

  it('parses a seconds-only duration', () => {
    expect(parseOpenProjectDuration('PT45S')).toBe(45);
  });

  it('is case-insensitive', () => {
    expect(parseOpenProjectDuration('pt1h30m')).toBe(5400);
  });

  it('trims surrounding whitespace', () => {
    expect(parseOpenProjectDuration('  PT1H  ')).toBe(3600);
  });

  it('returns null for a non-string value', () => {
    expect(parseOpenProjectDuration(3600)).toBeNull();
    expect(parseOpenProjectDuration(null)).toBeNull();
    expect(parseOpenProjectDuration(undefined)).toBeNull();
  });

  it('returns null for an unparseable string', () => {
    expect(parseOpenProjectDuration('not-a-duration')).toBeNull();
  });

  it('parses a bare PT prefix as zero seconds', () => {
    expect(parseOpenProjectDuration('PT')).toBe(0);
  });

  it('round-trips through formatOpenProjectDuration', () => {
    const seconds = 7384;
    expect(parseOpenProjectDuration(formatOpenProjectDuration(seconds))).toBe(seconds);
  });
});

describe('hrefId', () => {
  it('extracts the trailing numeric id from a href', () => {
    expect(hrefId('/api/v3/work_packages/42')).toBe('42');
  });

  it('extracts the id when the href has a query string', () => {
    expect(hrefId('/api/v3/work_packages/42?foo=bar')).toBe('42');
  });

  it('returns null for a non-string value', () => {
    expect(hrefId(undefined)).toBeNull();
    expect(hrefId(null)).toBeNull();
  });

  it('returns null when the href has no trailing numeric segment', () => {
    expect(hrefId('/api/v3/work_packages/')).toBeNull();
  });
});
