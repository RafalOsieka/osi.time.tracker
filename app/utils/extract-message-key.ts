import { RemoteAdapterError } from '~~/shared/types/remote-adapter';

/**
 * Reads a stable i18n messageKey from an ofetch-shaped error.
 * Nitro serializes `createError({ data: { messageKey } })` as
 * `{ statusCode, statusMessage, data: { messageKey } }`.
 * ofetch exposes that body as `err.data.data.messageKey`.
 */
export function extractMessageKey(err: Error & { data?: unknown }, fallback: string): string {
  const outer = err.data;
  if (!(outer instanceof Object) || !('data' in outer)) return fallback;
  const inner = outer.data;
  if (!(inner instanceof Object) || !('messageKey' in inner)) return fallback;
  const key = inner.messageKey;
  return key == null ? fallback : String(key);
}

/**
 * Maps a catch binding using real error classes (`RemoteAdapterError`, `Error`
 * with a Nitro/ofetch `data` envelope).
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- catch binding is implicitly unknown
export function extractCaughtMessageKey(err: unknown, fallback: string): string {
  if (err instanceof RemoteAdapterError) return err.messageKey;
  if (err instanceof Error && 'data' in err) {
    return extractMessageKey(err, fallback);
  }
  return fallback;
}
