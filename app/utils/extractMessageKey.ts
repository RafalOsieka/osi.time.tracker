/**
 * Extracts a stable i18n messageKey from a server error response.
 * Falls back to the provided key if the error shape doesn't match.
 *
 * Nitro serialises `createError({ data: { messageKey } })` into the response
 * body as `{ statusCode, statusMessage, data: { messageKey } }`.
 * ofetch exposes the parsed body as `FetchError.data`, so the full path is:
 *   err.data.data.messageKey
 */
export function extractMessageKey(err: unknown, fallback: string): string {
  if (err === null || typeof err !== 'object') return fallback;
  if (!('data' in err)) return fallback;
  const top = err.data;
  if (top === null || typeof top !== 'object') return fallback;
  if (!('data' in top)) return fallback;

  // Nitro createError shape: err.data.data.messageKey
  const nested = top.data;
  if (nested !== null && typeof nested === 'object' && 'messageKey' in nested) {
    if (typeof nested.messageKey === 'string') return nested.messageKey;
  }

  return fallback;
}
