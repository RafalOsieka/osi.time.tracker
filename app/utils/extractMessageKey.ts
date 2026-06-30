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
  const errObj = err as Record<string, unknown>;
  const top = errObj['data'];
  if (top === null || typeof top !== 'object') return fallback;
  const topObj = top as Record<string, unknown>;

  // Nitro createError shape: err.data.data.messageKey
  const nested = topObj['data'];
  if (nested !== null && typeof nested === 'object') {
    const nestedObj = nested as Record<string, unknown>;
    if (typeof nestedObj['messageKey'] === 'string') return nestedObj['messageKey'];
  }

  return fallback;
}
