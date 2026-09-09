import { describe, expect, it, vi } from 'vitest';
import { EXTENSION_ERROR_MESSAGE_KEYS } from '@osi/extension-protocol';
import {
  deriveExtensionAggregateState,
  orderReadinessTrackers,
  probeExtensionReadiness,
  type ExtensionConnectionState,
  type ExtensionReadinessTracker,
} from '../../app/utils/remote/extension-readiness';
import type { ExtensionAvailability } from '../../app/utils/remote/extension-availability';

function tracker(
  overrides: Partial<ExtensionReadinessTracker> & Pick<ExtensionReadinessTracker, 'id' | 'name'>,
): ExtensionReadinessTracker {
  return {
    systemType: 'openproject',
    baseUrl: `https://${overrides.id}.example.com`,
    directBrowserAccess: true,
    destinationApproved: null,
    ...overrides,
  };
}

describe('orderReadinessTrackers', () => {
  it('lists extension-required trackers first, then names', () => {
    const ordered = orderReadinessTrackers([
      tracker({ id: 'b', name: 'Beta', directBrowserAccess: true }),
      tracker({ id: 'z', name: 'Zulu', directBrowserAccess: false }),
      tracker({ id: 'a', name: 'Alpha', directBrowserAccess: false }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(['a', 'z', 'b']);
  });
});

describe('deriveExtensionAggregateState', () => {
  it('is neutral when no tracker requires the extension', () => {
    expect(
      deriveExtensionAggregateState({
        trackers: [],
        connection: 'unavailable',
      }),
    ).toBe('neutral');
    expect(
      deriveExtensionAggregateState({
        trackers: [tracker({ id: 'd', name: 'Direct', directBrowserAccess: true })],
        connection: 'unavailable',
      }),
    ).toBe('neutral');
  });

  it('stays checking until a required connection resolves', () => {
    expect(
      deriveExtensionAggregateState({
        trackers: [tracker({ id: 'e', name: 'Ext', directBrowserAccess: false })],
        connection: 'checking',
      }),
    ).toBe('checking');
  });

  it.each([
    'unavailable',
    'incompatible',
    'websiteUnapproved',
  ] as const satisfies readonly ExtensionConnectionState[])(
    'is red when connection is %s',
    (connection) => {
      expect(
        deriveExtensionAggregateState({
          trackers: [
            tracker({
              id: 'e',
              name: 'Ext',
              directBrowserAccess: false,
              destinationApproved: true,
            }),
          ],
          connection,
        }),
      ).toBe('red');
    },
  );

  it('is orange when a required destination is unapproved', () => {
    expect(
      deriveExtensionAggregateState({
        trackers: [
          tracker({
            id: 'e',
            name: 'Ext',
            directBrowserAccess: false,
            destinationApproved: false,
          }),
          tracker({
            id: 'd',
            name: 'Direct',
            directBrowserAccess: true,
            destinationApproved: true,
          }),
        ],
        connection: 'ready',
      }),
    ).toBe('orange');
  });

  it('is green when every required destination is approved', () => {
    expect(
      deriveExtensionAggregateState({
        trackers: [
          tracker({
            id: 'e',
            name: 'Ext',
            directBrowserAccess: false,
            destinationApproved: true,
          }),
          tracker({
            id: 'd',
            name: 'Direct',
            directBrowserAccess: true,
            destinationApproved: false,
          }),
        ],
        connection: 'ready',
      }),
    ).toBe('green');
  });

  it('stays checking while a required destination is still unresolved', () => {
    expect(
      deriveExtensionAggregateState({
        trackers: [
          tracker({
            id: 'e',
            name: 'Ext',
            directBrowserAccess: false,
            destinationApproved: null,
          }),
        ],
        connection: 'ready',
      }),
    ).toBe('checking');
  });

  it('does not let optional direct-capable approvals downgrade green or neutral', () => {
    expect(
      deriveExtensionAggregateState({
        trackers: [
          tracker({
            id: 'd',
            name: 'Direct',
            directBrowserAccess: true,
            destinationApproved: false,
          }),
        ],
        connection: 'unavailable',
      }),
    ).toBe('neutral');
  });
});

describe('probeExtensionReadiness', () => {
  it('reports unavailable, incompatible, website-unapproved, destination-unapproved, and approved', async () => {
    const probe = vi.fn();
    const required = {
      id: 'req',
      name: 'Required',
      systemType: 'openproject' as const,
      baseUrl: 'https://req.example.com',
      directBrowserAccess: false,
    };
    const optional = {
      id: 'opt',
      name: 'Optional',
      systemType: 'redmine' as const,
      baseUrl: 'https://opt.example.com',
      directBrowserAccess: true,
    };

    async function run(sequence: ExtensionAvailability[]) {
      probe.mockReset();
      for (const result of sequence) probe.mockResolvedValueOnce(result);
      return probeExtensionReadiness([required, optional], {
        isClient: true,
        probe,
      });
    }

    const unavailable = await run([
      { status: 'unavailable', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable },
    ]);
    expect(unavailable.connection).toBe('unavailable');
    expect(unavailable.aggregate).toBe('red');

    const incompatible = await run([
      { status: 'incompatible', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.incompatible },
    ]);
    expect(incompatible.connection).toBe('incompatible');
    expect(incompatible.aggregate).toBe('red');

    const website = await run([
      {
        status: 'websiteUnapproved',
        messageKey: EXTENSION_ERROR_MESSAGE_KEYS.originUnapproved,
      },
    ]);
    expect(website.connection).toBe('websiteUnapproved');
    expect(website.aggregate).toBe('red');

    const destination = await run([
      { status: 'available', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable },
      { status: 'permission', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.destinationUnapproved },
    ]);
    expect(destination.connection).toBe('ready');
    expect(destination.aggregate).toBe('orange');
    expect(destination.trackers[0]?.destinationApproved).toBe(false);
    expect(destination.trackers[1]?.destinationApproved).toBeNull();
    expect(JSON.stringify(probe.mock.calls)).not.toContain('secret');

    const approved = await run([
      { status: 'available', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable },
      { status: 'available', messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable },
    ]);
    expect(approved.aggregate).toBe('green');
    expect(approved.trackers[0]?.destinationApproved).toBe(true);
    expect(approved.trackers[1]?.destinationApproved).toBeNull();
  });

  it('emits tracker rows as soon as the website is approved', async () => {
    const progress: string[] = [];
    const required = {
      id: 'req',
      name: 'Required',
      systemType: 'openproject' as const,
      baseUrl: 'https://req.example.com',
      directBrowserAccess: false,
    };
    let releaseDestination: (() => void) | undefined;
    const destinationGate = new Promise<void>((resolve) => {
      releaseDestination = resolve;
    });
    const probe = vi.fn(async (options?: { destination?: unknown }) => {
      if (!options?.destination) {
        return {
          status: 'available' as const,
          messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable,
        };
      }
      await destinationGate;
      return { status: 'available' as const, messageKey: EXTENSION_ERROR_MESSAGE_KEYS.unavailable };
    });

    const pending = probeExtensionReadiness([required], {
      isClient: true,
      probe,
      onProgress(snapshot) {
        progress.push(
          `${snapshot.connection}:${snapshot.trackers[0]?.name}:${String(snapshot.trackers[0]?.destinationApproved)}`,
        );
      },
    });

    await vi.waitFor(() => {
      expect(progress[0]).toBe('ready:Required:null');
    });
    releaseDestination?.();
    await pending;
    expect(progress.at(-1)).toBe('ready:Required:true');
  });
});
