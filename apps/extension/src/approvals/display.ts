import type { DestinationApproval } from './approvals.js';

/**
 * An approved address as the pages show it: host, port and path, without the scheme. Every page
 * shows addresses this one way; a plain-HTTP tracker is flagged as unencrypted beside it instead.
 */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

/** A tracker destination as the pages show it: its address with the installation path. */
export function displayDestination(item: Pick<DestinationApproval, 'origin' | 'basePath'>): string {
  return displayUrl(`${item.origin}${item.basePath}`);
}

/** Whether a tracker is reached over plain HTTP, so its API key travels unencrypted. */
export function isPlainHttp(item: Pick<DestinationApproval, 'origin'>): boolean {
  return item.origin.startsWith('http://');
}
