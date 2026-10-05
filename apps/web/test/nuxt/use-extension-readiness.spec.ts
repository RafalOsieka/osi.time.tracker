import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { useExtensionReadiness } from '../../app/composables/use-extension-readiness';
import type {
  ExtensionReadinessSnapshot,
  probeExtensionReadiness,
} from '../../app/utils/remote/extension-readiness';
import type { TrackerDto } from '../../shared/types/tracker';

type Probe = typeof probeExtensionReadiness;

const trackersById = ref<Record<string, TrackerDto | null>>({});
const ensureAllLoaded = vi.fn(async () => undefined);

mockNuxtImport('useActiveTrackers', () => () => ({ trackersById, ensureAllLoaded }));

const direct: TrackerDto = {
  id: 'direct',
  name: 'Direct Tracker',
  systemType: 'openproject',
  baseUrl: 'https://direct.example',
  directBrowserAccess: true,
  roundingRule: 'none',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const viaExtension: TrackerDto = {
  ...direct,
  id: 'ext',
  name: 'Extension Tracker',
  baseUrl: 'https://ext.example',
  directBrowserAccess: false,
};

/** Probe result for the extension tracker with the given destination approval. */
function probed(destinationApproved: boolean | null): ExtensionReadinessSnapshot {
  return {
    connection: 'ready',
    messageKey: 'layout.extensionStatus.ready',
    aggregate: 'checking',
    trackers: [
      {
        id: viaExtension.id,
        name: viaExtension.name,
        systemType: viaExtension.systemType,
        baseUrl: viaExtension.baseUrl,
        directBrowserAccess: false,
        destinationApproved,
      },
    ],
  };
}

/** A probe whose answer the test releases by hand. */
function deferredProbe() {
  const releases: Array<() => void> = [];
  const probe = vi.fn<Probe>(
    () =>
      new Promise((resolve) => {
        releases.push(() => resolve(probed(true)));
      }),
  );
  return {
    probe,
    releaseAll: async () => {
      while (releases.length > 0) {
        releases.shift()?.();
        await flushPromises();
      }
    },
  };
}

const mounted: Array<{ unmount: () => void }> = [];

/** Mounts a throwaway host so the composable runs with real lifecycle hooks. */
async function setup(options: { isClient?: boolean; probe: Probe }) {
  let api!: ReturnType<typeof useExtensionReadiness>;
  const Host = defineComponent({
    setup() {
      api = useExtensionReadiness({ isClient: true, ...options });
      return () => h('div');
    },
  });
  const wrapper = await mountSuspended(Host);
  mounted.push(wrapper);
  await flushPromises();
  return { api, wrapper };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

beforeEach(() => {
  trackersById.value = {};
  ensureAllLoaded.mockClear();
  setVisibility('visible');
});

afterEach(() => {
  // Hosts keep their window/document listeners until unmounted.
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  setVisibility('visible');
});

describe('useExtensionReadiness', () => {
  it('is neutral and never probes when every tracker is reachable directly', async () => {
    trackersById.value = { [direct.id]: direct };
    const probe = vi.fn<Probe>();
    const { api } = await setup({ probe });

    expect(probe).not.toHaveBeenCalled();
    expect(api.snapshot.value).toMatchObject({
      connection: 'ready',
      messageKey: 'layout.extensionStatus.notRequired',
      aggregate: 'neutral',
    });
    expect(ensureAllLoaded).toHaveBeenCalled();
  });

  it('probes extension trackers and applies progress before the final result', async () => {
    trackersById.value = { [viaExtension.id]: viaExtension, [direct.id]: direct };
    let finish!: () => void;
    const probe = vi.fn<Probe>(
      (_trackers, options) =>
        new Promise((resolve) => {
          options?.onProgress?.(probed(false));
          finish = () => resolve(probed(true));
        }),
    );
    const { api } = await setup({ probe });

    expect(probe).toHaveBeenCalledWith([viaExtension, direct], expect.anything());
    expect(api.aggregate.value).toBe('orange');

    finish();
    await flushPromises();
    expect(api.aggregate.value).toBe('green');
  });

  it('keeps a known destination approval when a later probe has not resolved it yet', async () => {
    trackersById.value = { [viaExtension.id]: viaExtension };
    const probe = vi
      .fn<Probe>()
      .mockResolvedValueOnce(probed(true))
      .mockResolvedValueOnce(probed(null));
    const { api } = await setup({ probe });
    expect(api.aggregate.value).toBe('green');

    await api.recheck();
    await flushPromises();
    expect(probe).toHaveBeenCalledTimes(2);
    expect(api.snapshot.value.trackers[0]?.destinationApproved).toBe(true);
    expect(api.aggregate.value).toBe('green');
  });

  it('lists trackers but never probes during server rendering', async () => {
    trackersById.value = { [viaExtension.id]: viaExtension };
    const probe = vi.fn<Probe>();
    const { api } = await setup({ probe, isClient: false });

    expect(probe).not.toHaveBeenCalled();
    expect(api.snapshot.value.trackers.map((tracker) => tracker.id)).toEqual([viaExtension.id]);
    expect(api.aggregate.value).toBe('checking');
  });

  it('coalesces rechecks requested during a probe into one follow-up run', async () => {
    trackersById.value = { [viaExtension.id]: viaExtension };
    const { probe, releaseAll } = deferredProbe();
    const { api } = await setup({ probe });
    expect(probe).toHaveBeenCalledTimes(1);

    void api.recheck();
    void api.recheck();
    void api.recheck();
    await releaseAll();

    expect(probe).toHaveBeenCalledTimes(2);
    expect(api.aggregate.value).toBe('green');
  });

  it('rechecks when the page regains focus or becomes visible, not when it is hidden', async () => {
    trackersById.value = { [viaExtension.id]: viaExtension };
    const probe = vi.fn<Probe>(async () => probed(true));
    await setup({ probe });
    expect(probe).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('focus'));
    await flushPromises();
    expect(probe).toHaveBeenCalledTimes(2);

    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    expect(probe).toHaveBeenCalledTimes(3);

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    expect(probe).toHaveBeenCalledTimes(3);
  });

  it('stops listening for focus and visibility after unmount', async () => {
    trackersById.value = { [viaExtension.id]: viaExtension };
    const probe = vi.fn<Probe>(async () => probed(true));
    const { wrapper } = await setup({ probe });

    wrapper.unmount();
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('rechecks when a tracker switches to extension access', async () => {
    trackersById.value = { [direct.id]: direct };
    const probe = vi.fn<Probe>(async () => probed(true));
    const { api } = await setup({ probe });
    expect(api.aggregate.value).toBe('neutral');

    trackersById.value = { [direct.id]: { ...direct, directBrowserAccess: false } };
    await flushPromises();
    expect(probe).toHaveBeenCalledTimes(1);
    expect(api.aggregate.value).not.toBe('neutral');
  });
});
