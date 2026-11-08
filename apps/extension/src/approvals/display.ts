import type { DestinationApproval } from './approvals.js';

/**
 * An approved address as the pages show it: HTTPS is the norm, so its scheme is dropped, while
 * plain `http://` stays visible because it changes what the approval means.
 */
export function displayUrl(url: string): string {
  return url.startsWith('https://') ? url.slice('https://'.length) : url;
}

/** A tracker destination as the pages show it: its address with the installation path. */
export function displayDestination(item: Pick<DestinationApproval, 'origin' | 'basePath'>): string {
  return displayUrl(`${item.origin}${item.basePath}`);
}
