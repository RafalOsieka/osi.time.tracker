import { RemoteAdapterError } from './remote-adapter.js';
import type { RemoteTimeEntryDeleteOutcome } from './remote-time-log.js';
import { UpstreamHttpError } from './upstream-http-error.js';

/**
 * Maps a completed HTTP status to a delete outcome. Status `0` means the
 * request may have left the client without a parseable tracker response.
 */
export function mapTimeEntryDeleteStatus(status: number): RemoteTimeEntryDeleteOutcome {
  if (status >= 200 && status < 300) return { status: 'deleted' };
  if (status === 404) return { status: 'not_found' };
  if (status === 0) return { status: 'unknown', messageKey: 'error.remoteExportDeleteUnknown' };
  if (status === 401 || status === 403) {
    return { status: 'rejected', messageKey: 'error.remoteServerModeAuthRejected' };
  }
  return { status: 'rejected', messageKey: 'error.remoteExportDeleteRejected' };
}

/** Maps a thrown transport/adapter failure after a delete attempt. */
export function mapTimeEntryDeleteFailure(
  err: UpstreamHttpError | RemoteAdapterError | Error,
): RemoteTimeEntryDeleteOutcome {
  if (err instanceof UpstreamHttpError) {
    return mapTimeEntryDeleteStatus(err.statusCode);
  }
  if (err instanceof RemoteAdapterError) {
    return { status: 'rejected', messageKey: err.messageKey };
  }
  return { status: 'unknown', messageKey: 'error.remoteExportDeleteUnknown' };
}
