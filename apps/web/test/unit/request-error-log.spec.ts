import { describe, it, expect, vi } from 'vitest';
import type { H3Error } from 'h3';

// h3 is not a direct dependency of apps/web (Nitro resolves it internally), so unit
// tests build H3Error-shaped fakes instead of importing the real `createError`
// (same pattern as zod-input.spec.ts).
// oxlint-disable-next-line anti-slop/no-module-mocking -- h3 request helpers are not a project seam
vi.mock('h3', () => ({}));

const { describeRequestError } = await import('../../server/utils/request-error-log');

function fakeError(opts: {
  statusCode?: number;
  data?: unknown;
  cause?: unknown;
  unhandled?: boolean;
  fatal?: boolean;
}): H3Error {
  // SAFETY: a plain Error is widened to H3Error only for this test fixture; every
  // field describeRequestError reads is set explicitly below.
  const err = new Error('request failed') as H3Error;
  err.statusCode = opts.statusCode ?? 0;
  err.data = opts.data;
  err.cause = opts.cause;
  err.unhandled = opts.unhandled ?? false;
  err.fatal = opts.fatal ?? false;
  return err;
}

const ctx = { method: 'POST', path: '/api/trackers' };

describe('describeRequestError', () => {
  it('formats a 400 with no data (e.g. a middleware rejection) as a warn line', () => {
    const err = fakeError({ statusCode: 400 });
    const entry = describeRequestError(err, ctx);
    expect(entry).toEqual({ level: 'warn', message: '[POST] /api/trackers -> 400' });
  });

  it('formats a 422 with messageKey and primitive params as a warn line', () => {
    const err = fakeError({
      statusCode: 422,
      data: { messageKey: 'error.projectNameTooLong', params: { max: 100 } },
    });
    const entry = describeRequestError(err, ctx);
    expect(entry).toEqual({
      level: 'warn',
      message: '[POST] /api/trackers -> 422 error.projectNameTooLong {"max":100}',
    });
  });

  it('formats a 500 error as an error line and includes the error for the stack', () => {
    const cause = new Error('connection refused');
    const err = fakeError({ statusCode: 500, data: { messageKey: 'error.unknown' }, cause });
    const entry = describeRequestError(err, ctx);
    expect(entry?.level).toBe('error');
    expect(entry?.message).toBe('[POST] /api/trackers -> 500 error.unknown');
    expect(entry?.error).toBe(err);
    expect(entry?.error?.cause).toBe(cause);
  });

  it('returns null for an error already logged by h3/Nitro as unhandled', () => {
    const err = fakeError({ statusCode: 500, unhandled: true });
    expect(describeRequestError(err, ctx)).toBeNull();
  });

  it('returns null for a fatal error', () => {
    const err = fakeError({ statusCode: 500, fatal: true });
    expect(describeRequestError(err, ctx)).toBeNull();
  });

  it('ignores data that does not match the ApiMessage contract', () => {
    const err = fakeError({ statusCode: 422, data: { reason: 'nope' } });
    const entry = describeRequestError(err, ctx);
    expect(entry).toEqual({ level: 'warn', message: '[POST] /api/trackers -> 422' });
  });

  it('never includes a body-like object passed as data in the message', () => {
    const err = fakeError({
      statusCode: 422,
      data: { messageKey: 'error.trackerApiKeyInvalid', apiKey: 'super-secret-key' },
    });
    const entry = describeRequestError(err, ctx);
    expect(entry?.message).toBe('[POST] /api/trackers -> 422 error.trackerApiKeyInvalid');
    expect(entry?.message).not.toContain('super-secret-key');
  });

  it('rejects the whole data (not just the bad key) when a param is not a primitive', () => {
    const err = fakeError({
      statusCode: 422,
      data: { messageKey: 'error.unknown', params: { min: 1, nested: { leak: true } } },
    });
    const entry = describeRequestError(err, ctx);
    expect(entry).toEqual({ level: 'warn', message: '[POST] /api/trackers -> 422' });
  });

  it('defaults a falsy statusCode to 500', () => {
    const err = fakeError({ statusCode: 0, data: { messageKey: 'error.unknown' } });
    const entry = describeRequestError(err, ctx);
    expect(entry?.level).toBe('error');
    expect(entry?.message).toBe('[POST] /api/trackers -> 500 error.unknown');
  });
});
