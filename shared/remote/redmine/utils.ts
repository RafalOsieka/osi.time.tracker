/**
 * Converts already-rounded whole seconds to Redmine decimal hours at 0.01 h
 * precision (`hours = Math.round(seconds / 36) / 100`).
 */
export function secondsToRedmineHours(durationSeconds: number): number {
  return Math.round(durationSeconds / 36) / 100;
}

/**
 * Converts Redmine decimal hours back to whole seconds
 * (`seconds = Math.round(hours * 3600)`).
 */
export function redmineHoursToSeconds(hours: number): number {
  return Math.round(hours * 3600);
}

/**
 * Builds the Redmine API-key auth header map, or `undefined` when no secret.
 * Auth is constructed in exactly one place in the Redmine client.
 */
export function redmineAuthHeaders(secret: string | null): Record<string, string> | undefined {
  if (!secret) return undefined;
  return { 'X-Redmine-API-Key': secret };
}
