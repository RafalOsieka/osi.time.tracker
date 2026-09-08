import { describe, expect, it, vi } from 'vitest';
import { reactive, nextTick } from 'vue';
import { useTrackerExtensionAvailability } from '../../app/composables/use-tracker-extension-availability';
import type { TrackerExecutionMode } from '../../shared/types/tracker';
import type { TrackerSystemType } from '@osi/remote-trackers/contracts';

describe('useTrackerExtensionAvailability', () => {
  it('stays idle for non-extension modes and does not probe', async () => {
    const probe = vi.fn();
    const source = reactive({
      executionMode: 'client' as TrackerExecutionMode,
      systemType: 'openproject' as TrackerSystemType,
      baseUrl: 'https://op.example.com',
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
      executionMode: 'extension' as TrackerExecutionMode,
      systemType: 'openproject' as TrackerSystemType,
      baseUrl: 'https://op.example.com',
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

  it('does not probe during SSR', async () => {
    const probe = vi.fn();
    const source = reactive({
      executionMode: 'extension' as TrackerExecutionMode,
      systemType: 'openproject' as TrackerSystemType,
      baseUrl: 'https://op.example.com',
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
