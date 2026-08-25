import { RemoteAdapterError } from '../../shared/types/remote-adapter';

type NitroErrorEnvelope = { data?: { messageKey?: string } };

/**
 * Reads a stable i18n messageKey from an ofetch-shaped error.
 * Nitro serialises `createError({ data: { messageKey } })` as
 * `{ statusCode, statusMessage, data: { messageKey } }`.
 * ofetch exposes that body as `err.data.data.messageKey`.
 */
export function extractMessageKey(
  err: Error & { data?: NitroErrorEnvelope },
  fallback: string,
): string {
  return err.data?.data?.messageKey ?? fallback;
}

/**
 * Maps a catch binding using real error classes (`RemoteAdapterError`, `Error`
 * with a Nitro/ofetch `data` envelope).
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- catch binding is implicitly unknown
export function extractCaughtMessageKey(err: unknown, fallback: string): string {
  if (err instanceof RemoteAdapterError) return err.messageKey;
  if (err instanceof Error && 'data' in err) {
    // SAFETY: ofetch FetchError is an Error with a Nitro `{ data: ApiMessage }` envelope.
    return extractMessageKey(err as Error & { data?: NitroErrorEnvelope }, fallback);
  }
  return fallback;
}
