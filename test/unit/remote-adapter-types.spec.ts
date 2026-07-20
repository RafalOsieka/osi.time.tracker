import { describe, expect, it } from 'vitest';
import { RemoteAdapterError } from '../../shared/types/remote-adapter';

describe('RemoteAdapterError', () => {
  it('carries a message key and is an Error instance', () => {
    const err = new RemoteAdapterError('error.remoteIssueSearchFailed');
    expect(err).toBeInstanceOf(Error);
    expect(err.messageKey).toBe('error.remoteIssueSearchFailed');
    expect(err.status).toBeUndefined();
    expect(err.name).toBe('RemoteAdapterError');
  });

  it('carries an optional upstream status', () => {
    const err = new RemoteAdapterError('error.remoteServerModeAuthRejected', 401);
    expect(err.messageKey).toBe('error.remoteServerModeAuthRejected');
    expect(err.status).toBe(401);
  });
});
