import {
  destinationKey,
  type DestinationApproval,
  type WebsiteApproval,
} from '../approvals/approvals.js';
import { displayDestination, displayUrl } from '../approvals/display.js';

/**
 * The popup's one-word summary, most urgent first: settings could not be read, the browser took
 * access away, trackers wait for review, setup is unfinished, or everything works.
 */
export type ExtensionStatus = 'error' | 'access' | 'review' | 'setup' | 'ready';

export function extensionStatus(state: {
  failed: boolean;
  missingAccess: number;
  pendingSuggestions: number;
  setupComplete: boolean;
}): ExtensionStatus {
  if (state.failed) return 'error';
  if (state.missingAccess > 0) return 'access';
  if (state.pendingSuggestions > 0) return 'review';
  if (!state.setupComplete) return 'setup';
  return 'ready';
}

/**
 * A saved approval whose origin the browser no longer grants. `focus` names its restore control
 * on the setup page (the `restore-…` test id suffix), so the popup can hand it over.
 */
export type MissingAccess =
  | { kind: 'website'; name: string; focus: string; origin: string }
  | { kind: 'tracker'; name: string; focus: string; approval: DestinationApproval };

/** Every approval that lost browser access: websites first, then trackers, in list order. */
export function missingAccessItems(
  websites: readonly WebsiteApproval[],
  destinations: readonly DestinationApproval[],
  missingOrigins: readonly string[],
): MissingAccess[] {
  const lost = new Set(missingOrigins);
  return [
    ...websites
      .filter((item) => lost.has(item.origin))
      .map((item): MissingAccess => ({
        kind: 'website',
        name: displayUrl(item.origin),
        focus: `website-${item.origin}`,
        origin: item.origin,
      })),
    ...destinations
      .filter((item) => lost.has(item.origin))
      .map((item): MissingAccess => ({
        kind: 'tracker',
        name: displayDestination(item),
        focus: `destination-${destinationKey(item)}`,
        approval: item,
      })),
  ];
}
