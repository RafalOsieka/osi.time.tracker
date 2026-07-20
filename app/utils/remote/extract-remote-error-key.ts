import { RemoteAdapterError } from '../../../shared/types/remote-adapter';
import { extractMessageKey } from '../extractMessageKey';

/**
 * Extracts a translation key from either a `RemoteAdapterError` thrown
 * directly by a `client`-execution-mode adapter call, or a Nitro
 * `createError` response forwarded through `$csrfFetch` (`server`
 * execution mode). Falls back to `fallback` for anything else.
 */
export function extractRemoteErrorKey(err: unknown, fallback: string): string {
  if (err instanceof RemoteAdapterError) {
    return err.messageKey;
  }
  return extractMessageKey(err, fallback);
}
