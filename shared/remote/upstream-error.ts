import { RemoteAdapterError } from '../types/remote-adapter';
import { UpstreamHttpError } from './upstream-http-error';

export { UpstreamHttpError };

/** Passes a same-origin-guard `RemoteAdapterError` through; maps HTTP/network failures. */
export function toAdapterError(
  err: RemoteAdapterError | UpstreamHttpError | Error,
  failureMessageKey: string,
): RemoteAdapterError {
  if (err instanceof RemoteAdapterError) return err;

  const status = err instanceof UpstreamHttpError ? err.statusCode : undefined;

  if (status === 401 || status === 403) {
    // Conceal the exact upstream status so the auth-rejection response
    // never leaks provider-specific detail about the rejected credential.
    return new RemoteAdapterError('error.remoteServerModeAuthRejected', 502);
  }

  if (status !== undefined) {
    return new RemoteAdapterError(failureMessageKey, status);
  }

  // No HTTP status at all: connection refused, timeout, or DNS failure.
  return new RemoteAdapterError('error.remoteServerModeConnectionFailed');
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- catch binding is implicitly unknown
export function rethrowAsAdapterError(err: unknown, failureMessageKey: string): never {
  if (
    err instanceof RemoteAdapterError ||
    err instanceof UpstreamHttpError ||
    err instanceof Error
  ) {
    throw toAdapterError(err, failureMessageKey);
  }
  throw err;
}
