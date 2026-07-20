/**
 * Removes any trailing slash(es) so URL joining never produces a double
 * slash, regardless of how the configured base URL was entered.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}
