import type { TrackerSystemType } from '@osi/remote-trackers/contracts';
import type { DestinationSelector } from '@osi/extension-protocol';
import type { TrackerDto } from '../../../shared/types/tracker';
import {
  probeExtensionAvailability,
  type ExtensionAvailability,
  type ExtensionAvailabilityOptions,
} from './extension-availability';

export type ExtensionAggregateState = 'neutral' | 'checking' | 'red' | 'orange' | 'green';

export type ExtensionConnectionState =
  | 'checking'
  | 'unavailable'
  | 'incompatible'
  | 'websiteUnapproved'
  | 'ready';

export interface ExtensionReadinessTracker {
  id: string;
  name: string;
  systemType: TrackerSystemType;
  baseUrl: string;
  directBrowserAccess: boolean;
  destinationApproved: boolean | null;
}

export interface ExtensionReadinessSnapshot {
  connection: ExtensionConnectionState;
  messageKey: string;
  aggregate: ExtensionAggregateState;
  trackers: ExtensionReadinessTracker[];
}

function destinationFrom(
  systemType: TrackerSystemType,
  baseUrl: string,
): DestinationSelector | undefined {
  const trimmed = baseUrl.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return { provider: systemType, baseUrl: trimmed };
  } catch {
    return undefined;
  }
}

/** Required (extension-needed) trackers first, then name. */
export function orderReadinessTrackers(
  trackers: readonly ExtensionReadinessTracker[],
): ExtensionReadinessTracker[] {
  return [...trackers].sort((left, right) => {
    const requiredDelta = Number(left.directBrowserAccess) - Number(right.directBrowserAccess);
    if (requiredDelta !== 0) return requiredDelta;
    return left.name.localeCompare(right.name);
  });
}

/**
 * Neutral when no tracker requires the extension. Direct-capable destination
 * approvals never downgrade red/orange/green.
 */
export function deriveExtensionAggregateState(input: {
  trackers: readonly Pick<
    ExtensionReadinessTracker,
    'directBrowserAccess' | 'destinationApproved'
  >[];
  connection: ExtensionConnectionState;
}): ExtensionAggregateState {
  const required = input.trackers.filter((tracker) => !tracker.directBrowserAccess);
  if (required.length === 0) return 'neutral';
  if (input.connection === 'checking') return 'checking';
  if (
    input.connection === 'unavailable' ||
    input.connection === 'incompatible' ||
    input.connection === 'websiteUnapproved'
  ) {
    return 'red';
  }
  if (required.some((tracker) => tracker.destinationApproved !== true)) return 'orange';
  return 'green';
}

export async function probeExtensionReadiness(
  trackers: readonly Pick<
    TrackerDto,
    'id' | 'name' | 'systemType' | 'baseUrl' | 'directBrowserAccess'
  >[],
  options: ExtensionAvailabilityOptions & {
    probe?: (options?: ExtensionAvailabilityOptions) => Promise<ExtensionAvailability>;
  } = {},
): Promise<ExtensionReadinessSnapshot> {
  const probe = options.probe ?? probeExtensionAvailability;
  const ordered = orderReadinessTrackers(
    trackers.map((tracker) => ({
      id: tracker.id,
      name: tracker.name,
      systemType: tracker.systemType,
      baseUrl: tracker.baseUrl,
      directBrowserAccess: tracker.directBrowserAccess,
      destinationApproved: null,
    })),
  );

  const website = await probe({
    isClient: options.isClient,
    openBridge: options.openBridge,
    bridgeOptions: options.bridgeOptions,
    destination: undefined,
  });

  if (website.status === 'unavailable') {
    return finish('unavailable', website.messageKey, ordered);
  }
  if (website.status === 'incompatible') {
    return finish('incompatible', website.messageKey, ordered);
  }
  if (website.status === 'websiteUnapproved') {
    return finish('websiteUnapproved', website.messageKey, ordered);
  }

  const resolved: ExtensionReadinessTracker[] = [];
  for (const tracker of ordered) {
    const destination = destinationFrom(tracker.systemType, tracker.baseUrl);
    if (!destination) {
      resolved.push({ ...tracker, destinationApproved: false });
      continue;
    }
    const result = await probe({
      isClient: options.isClient,
      openBridge: options.openBridge,
      bridgeOptions: options.bridgeOptions,
      destination,
    });
    resolved.push({
      ...tracker,
      destinationApproved: result.status === 'available',
    });
  }

  return finish('ready', website.messageKey, resolved);
}

function finish(
  connection: Exclude<ExtensionConnectionState, 'checking'>,
  messageKey: string,
  trackers: ExtensionReadinessTracker[],
): ExtensionReadinessSnapshot {
  return {
    connection,
    messageKey,
    aggregate: deriveExtensionAggregateState({ trackers, connection }),
    trackers,
  };
}
