/**
 * Removes any trailing slash(es) so URL joining never produces a double
 * slash, regardless of how the configured base URL was entered.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  let end = baseUrl.length;
  while (end > 0 && baseUrl[end - 1] === '/') {
    end -= 1;
  }
  return baseUrl.slice(0, end);
}
