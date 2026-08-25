import { describe, expect, it } from 'vitest';
import { RemoteAdapterError } from '../../shared/types/remote-adapter';
import { toAdapterError, UpstreamHttpError } from '../../shared/remote/upstream-error';

describe('toAdapterError', () => {
  it('maps 401/403 to the auth-rejected key without leaking status', () => {
    const mapped = toAdapterError(new UpstreamHttpError(401), 'error.remoteIssueSearchFailed');
    expect(mapped).toBeInstanceOf(RemoteAdapterError);
    expect(mapped.messageKey).toBe('error.remoteServerModeAuthRejected');
    expect(mapped.status).toBe(502);
  });

  it('passes RemoteAdapterError through unchanged', () => {
    const original = new RemoteAdapterError('error.remoteIssueSearchFailed', 404);
    expect(toAdapterError(original, 'error.other')).toBe(original);
  });

  it('maps a throw with no HTTP status to connection-failed', () => {
    const mapped = toAdapterError(new Error('ECONNREFUSED'), 'error.other');
    expect(mapped.messageKey).toBe('error.remoteServerModeConnectionFailed');
  });

  it('maps a non-auth HTTP status to the operation key', () => {
    const mapped = toAdapterError(new UpstreamHttpError(500), 'error.remoteIssueSearchFailed');
    expect(mapped.messageKey).toBe('error.remoteIssueSearchFailed');
    expect(mapped.status).toBe(500);
  });
});
