/**
 * Extracts a stable i18n messageKey from a server error response.
 * Falls back to the provided default key if the error shape doesn't match.
 */
export function extractMessageKey(err: unknown, fallback = 'auth.loginFailed'): string {
  if (err === null || typeof err !== 'object') return fallback;
  const errObj = err as Record<string, unknown>;
  const data = errObj['data'];
  if (data === null || typeof data !== 'object') return fallback;
  const dataObj = data as Record<string, unknown>;
  const key = dataObj['messageKey'];
  return typeof key === 'string' ? key : fallback;
}
