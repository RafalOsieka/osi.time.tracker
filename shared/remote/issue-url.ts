import type { TrackerSystemType } from '../types/tracker';
import { normalizeBaseUrl } from '../utils/normalize-base-url';

type IssueUrlBuilder = (baseUrl: string, remoteIssueId: string) => string;

const ISSUE_URL_BUILDERS = {
  openproject: (baseUrl, remoteIssueId) =>
    `${normalizeBaseUrl(baseUrl)}/work_packages/${encodeURIComponent(remoteIssueId)}`,
  redmine: (baseUrl, remoteIssueId) =>
    `${normalizeBaseUrl(baseUrl)}/issues/${encodeURIComponent(remoteIssueId)}`,
} as const satisfies Record<TrackerSystemType, IssueUrlBuilder>;

/**
 * Derives a usable issue URL from a configuration's `systemType`, normalized
 * base URL, and remote issue id via a per-provider dispatch table.
 */
export function deriveIssueUrl(
  systemType: TrackerSystemType,
  baseUrl: string,
  remoteIssueId: string,
): string {
  return ISSUE_URL_BUILDERS[systemType](baseUrl, remoteIssueId);
}
