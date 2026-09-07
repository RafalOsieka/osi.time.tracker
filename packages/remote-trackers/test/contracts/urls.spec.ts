import { describe, expect, it } from 'vitest';
import { deriveIssueUrl, normalizeBaseUrl } from '@osi/remote-trackers/contracts';

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
