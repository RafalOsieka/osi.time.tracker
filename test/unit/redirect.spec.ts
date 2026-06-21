import { describe, expect, it } from 'vitest';
import { sanitizeRedirect } from '../../app/utils/redirect';

describe('sanitizeRedirect', () => {
  it('accepts same-origin paths starting with a single slash', () => {
    expect(sanitizeRedirect('/')).toBe('/');
    expect(sanitizeRedirect('/clients')).toBe('/clients');
    expect(sanitizeRedirect('/clients?foo=bar#frag')).toBe('/clients?foo=bar#frag');
  });

  it('rejects protocol-relative and absolute URLs', () => {
    expect(sanitizeRedirect('//evil.com')).toBe('/');
    expect(sanitizeRedirect('https://evil.com')).toBe('/');
    expect(sanitizeRedirect('http://evil.com/path')).toBe('/');
    expect(sanitizeRedirect('/\\evil.com')).toBe('/');
  });

  it('rejects non-string and relative values', () => {
    expect(sanitizeRedirect(undefined)).toBe('/');
    expect(sanitizeRedirect(null)).toBe('/');
    expect(sanitizeRedirect(['/a', '/b'])).toBe('/');
    expect(sanitizeRedirect('relative/path')).toBe('/');
    expect(sanitizeRedirect('')).toBe('/');
  });

  it('honors a custom fallback', () => {
    expect(sanitizeRedirect('//evil.com', '/home')).toBe('/home');
    expect(sanitizeRedirect(undefined, '/home')).toBe('/home');
  });
});
