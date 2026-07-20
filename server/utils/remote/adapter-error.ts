import { RemoteAdapterError } from '../../../shared/types/remote-adapter';
import type { ApiMessage } from '../../types/api-message';

/**
 * Maps a `RemoteAdapterError` (thrown by the shared provider adapter,
 * regardless of execution mode) to the server's `{ messageKey, params }`
 * error contract. Rethrows anything else unchanged.
 */
export function toApiError(err: unknown): never {
  if (err instanceof RemoteAdapterError) {
    throw createError({
      statusCode: err.status ?? 502,
      data: { messageKey: err.messageKey } satisfies ApiMessage,
    });
  }
  throw err;
}
