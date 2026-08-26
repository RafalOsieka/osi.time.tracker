import { describe, it, expect } from 'vitest';
import { extractCaughtMessageKey, extractMessageKey } from '../../app/utils/extract-message-key';
import { RemoteAdapterError } from '../../shared/types/remote-adapter';
import type { MessageParams } from '../../shared/types/message-params';

type NitroFetchError = Error & { data?: { data?: { messageKey?: string } } };

function nitroFetchError(messageKey: string): NitroFetchError {
  const err: NitroFetchError = new Error('request failed');
  err.data = { data: { messageKey } };
  return err;
}

describe('extractMessageKey', () => {
  it('returns messageKey from err.data.data.messageKey', () => {
    expect(extractMessageKey(nitroFetchError('error.trackerNameDuplicate'), 'fallback')).toBe(
      'error.trackerNameDuplicate',
    );
  });

  it('returns fallback when nested data has no messageKey', () => {
    const err: NitroFetchError = new Error('request failed');
    err.data = { data: {} };
    expect(extractMessageKey(err, 'fallback')).toBe('fallback');
  });

  it('returns fallback when err.data has no nested data', () => {
    const err: NitroFetchError = new Error('request failed');
    err.data = {};
    expect(extractMessageKey(err, 'fallback')).toBe('fallback');
  });
});

describe('extractCaughtMessageKey', () => {
  it('reads messageKey from a RemoteAdapterError', () => {
    const err = new RemoteAdapterError('error.remoteIssueSearchFailed', 502);
    expect(extractCaughtMessageKey(err, 'fallback')).toBe('error.remoteIssueSearchFailed');
  });

  it('reads messageKey from a Nitro/ofetch Error', () => {
    expect(extractCaughtMessageKey(nitroFetchError('error.trackerNameDuplicate'), 'fallback')).toBe(
      'error.trackerNameDuplicate',
    );
  });

  it('returns fallback for a non-matching throw', () => {
    expect(extractCaughtMessageKey('boom', 'fallback')).toBe('fallback');
    expect(extractCaughtMessageKey(null, 'fallback')).toBe('fallback');
    expect(extractCaughtMessageKey(new Error('nope'), 'fallback')).toBe('fallback');
  });
});

describe('MessageParams', () => {
  it('accepts only primitive interpolation values', () => {
    const params: MessageParams = { min: 1, expected: 'string', flag: true };
    expect(params.min).toBe(1);
    expect(params.expected).toBe('string');
    expect(params.flag).toBe(true);
  });
});
