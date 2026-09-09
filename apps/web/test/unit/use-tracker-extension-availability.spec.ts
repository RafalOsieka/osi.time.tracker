import { describe, expect, it, vi } from 'vitest';
import { reactive, nextTick } from 'vue';
import { useTrackerExtensionAvailability } from '../../app/composables/use-tracker-extension-availability';
import type { TrackerExecutionMode } from '../../shared/types/tracker';
import type { TrackerSystemType } from '@osi/remote-trackers/contracts';
import type { ExtensionAvailability } from '../../app/utils/remote/extension-availability';

describe('useTrackerExtensionAvailability', () => {
  it.each(['recheck', 'destination', 'provider', 'mode'])(
    'ignores an older probe after changing %s',
    async (change) => {
      const first = Promise.withResolvers<ExtensionAvailability>();
      const second = Promise.withResolvers<ExtensionAvailability>();
      const probe = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
      const source = reactive<{
        executionMode: TrackerExecutionMode;
        systemType: TrackerSystemType;
        baseUrl: string;
      }>({ executionMode: 'extension', systemType: 'openproject', baseUrl: 'https://old.example' });
      const availability = useTrackerExtensionAvailability(() => source, { isClient: true, probe });
      if (change === 'destination') source.baseUrl = 'https://new.example';
      if (change === 'provider') source.systemType = 'redmine';
      if (change === 'mode') {
        source.executionMode = 'client';
        await nextTick();
        source.executionMode = 'extension';
      }
      if (change === 'recheck') void availability.recheck();
      await nextTick();
      second.resolve({ status: 'permission', messageKey: 'error.extensionDestinationUnapproved' });
      await second.promise;
      first.resolve({ status: 'available', messageKey: 'error.extensionUnavailable' });
      await first.promise;
      expect(availability.status.value).toBe('permission');
      expect(availability.messageKey.value).toBe('error.extensionDestinationUnapproved');
    },
  );
  it('stays idle for non-extension modes and does not probe', async () => {
    const probe = vi.fn();
    const source = reactive({
      executionMode: 'client',
      systemType: 'openproject',
      baseUrl: 'https://op.example.com',
    } satisfies {
      executionMode: TrackerExecutionMode;
      systemType: TrackerSystemType;
      baseUrl: string;
    });
    const { visible, status } = useTrackerExtensionAvailability(() => source, {
      isClient: true,
      probe,
    });
    await nextTick();
    expect(visible.value).toBe(false);
    expect(status.value).toBe('idle');
    expect(probe).not.toHaveBeenCalled();
  });

  it('probes without a secret and reports availability on recheck', async () => {
    const probe = vi.fn().mockResolvedValue({
      status: 'available',
      messageKey: 'error.extensionUnavailable',
    });
    const source = reactive({
      executionMode: 'extension',
      systemType: 'openproject',
      baseUrl: 'https://op.example.com',
    } satisfies {
      executionMode: TrackerExecutionMode;
      systemType: TrackerSystemType;
      baseUrl: string;
    });
    const { visible, status, recheck } = useTrackerExtensionAvailability(() => source, {
      isClient: true,
      probe,
    });
    await nextTick();
    await Promise.resolve();
    expect(visible.value).toBe(true);
    expect(probe).toHaveBeenCalledWith({
      isClient: true,
      destination: { provider: 'openproject', baseUrl: 'https://op.example.com' },
    });
    expect(JSON.stringify(probe.mock.calls)).not.toContain('secret');
    expect(status.value).toBe('available');

    probe.mockResolvedValueOnce({
      status: 'permission',
      messageKey: 'error.extensionDestinationUnapproved',
    });
    await recheck();
    expect(status.value).toBe('permission');
  });

  it.each(['', '   ', 'not a url', 'ftp://op.example.com'])(
    'probes without a destination for invalid base URL %j',
    async (baseUrl) => {
      const probe = vi.fn().mockResolvedValue({
        status: 'available',
        messageKey: 'error.extensionUnavailable',
      });
      const source = reactive({
        executionMode: 'extension',
        systemType: 'openproject',
        baseUrl,
      } satisfies {
        executionMode: TrackerExecutionMode;
        systemType: TrackerSystemType;
        baseUrl: string;
      });
      useTrackerExtensionAvailability(() => source, { isClient: true, probe });
      await nextTick();
      await Promise.resolve();
      expect(probe).toHaveBeenCalledWith({ isClient: true, destination: undefined });
    },
  );

  it('does not probe during SSR', async () => {
    const probe = vi.fn();
    const source = reactive({
      executionMode: 'extension',
      systemType: 'openproject',
      baseUrl: 'https://op.example.com',
    } satisfies {
      executionMode: TrackerExecutionMode;
      systemType: TrackerSystemType;
      baseUrl: string;
    });
    const { status } = useTrackerExtensionAvailability(() => source, {
      isClient: false,
      probe,
    });
    await nextTick();
    expect(probe).not.toHaveBeenCalled();
    expect(status.value).toBe('unavailable');
  });
});
