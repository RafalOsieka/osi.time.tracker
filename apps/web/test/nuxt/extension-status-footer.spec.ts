import { describe, expect, it, vi, beforeEach } from 'vitest';
import { computed } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import ExtensionStatusFooter from '../../app/components/ExtensionStatusFooter.vue';
import type {
  ExtensionAggregateState,
  ExtensionReadinessSnapshot,
} from '../../app/utils/remote/extension-readiness';

const state = vi.hoisted(() => {
  const snapshot: ExtensionReadinessSnapshot = {
    connection: 'ready',
    messageKey: 'layout.extensionStatus.notRequired',
    aggregate: 'neutral',
    trackers: [],
  };
  return { snapshot, recheck: vi.fn(), approve: vi.fn() };
});

mockNuxtImport('useExtensionReadiness', () => () => ({
  snapshot: computed(() => state.snapshot),
  aggregate: computed(() => state.snapshot.aggregate),
  recheck: state.recheck,
  approveDestination: state.approve,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string, params?: { status?: string }) => params?.status ?? key }),
  };
});

const PopoverStub = {
  props: { open: { type: Boolean, default: false } },
  emits: ['update:open'],
  template: `
    <div>
      <div
        data-testid="popover-trigger"
        @mouseenter="$emit('update:open', true)"
        @focusin="$emit('update:open', true)"
        @click="$emit('update:open', true)"
      >
        <slot />
      </div>
      <div v-if="open" data-testid="extension-status-popover-host">
        <slot name="content" />
      </div>
    </div>
  `,
};

const stubs = {
  UPopover: PopoverStub,
  UButton: {
    props: ['label', 'icon', 'square', 'block'],
    template:
      '<button type="button" v-bind="$attrs" @click="$emit(\'click\')" @focus="$emit(\'focus\')">{{ label }}<slot /></button>',
  },
};

const requiredTracker = {
  id: 'req',
  name: 'Required Tracker',
  systemType: 'openproject' as const,
  baseUrl: 'https://req.example.com',
  directBrowserAccess: false,
  destinationApproved: false,
};

const optionalTracker = {
  id: 'opt',
  name: 'Optional Tracker',
  systemType: 'redmine' as const,
  baseUrl: 'https://opt.example.com',
  directBrowserAccess: true,
  destinationApproved: false,
};

async function mountFooter(collapsed = false) {
  return mountSuspended(ExtensionStatusFooter, {
    props: { collapsed },
    global: { stubs },
  });
}

describe('ExtensionStatusFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.snapshot = {
      connection: 'ready',
      messageKey: 'layout.extensionStatus.notRequired',
      aggregate: 'neutral',
      trackers: [],
    };
  });

  it.each([
    ['neutral', 'layout.extensionStatus.notRequired'],
    ['checking', 'layout.extensionStatus.checking'],
    ['red', 'layout.extensionStatus.invalid'],
    ['orange', 'layout.extensionStatus.partial'],
    ['green', 'layout.extensionStatus.ready'],
  ] as const satisfies ReadonlyArray<readonly [ExtensionAggregateState, string]>)(
    'renders %s aggregate status with non-color semantics',
    async (aggregateState, key) => {
      state.snapshot = { ...state.snapshot, aggregate: aggregateState };
      const wrapper = await mountFooter();
      expect(wrapper.get('[data-testid="extension-status-label"]').text()).toBe(key);
      expect(wrapper.get('[data-testid="extension-status-semantics"]').text()).toBe(key);
      expect(
        wrapper.get('[data-testid="extension-status-semantics"]').attributes('data-state'),
      ).toBe(aggregateState);
    },
  );

  it('keeps a collapsed icon trigger with an accessible status name', async () => {
    state.snapshot = { ...state.snapshot, aggregate: 'red' };
    const wrapper = await mountFooter(true);
    expect(wrapper.find('[data-testid="extension-status-label"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="extension-status-trigger"]').attributes('aria-label')).toBe(
      'layout.extensionStatus.invalid',
    );
  });

  it('opens details from keyboard focus and lists required trackers first', async () => {
    state.snapshot = {
      connection: 'ready',
      messageKey: 'error.extensionUnavailable',
      aggregate: 'orange',
      trackers: [optionalTracker, requiredTracker],
    };
    const wrapper = await mountFooter();
    await wrapper.get('[data-testid="extension-status-trigger"]').trigger('focus');
    await flushPromises();
    const destinations = wrapper.findAll('[data-testid^="extension-status-destination-"]');
    expect(destinations[0]?.attributes('data-testid')).toBe('extension-status-destination-req');
    expect(destinations[0]?.attributes('data-required')).toBe('required');
    expect(destinations[1]?.attributes('data-required')).toBe('optional');
    expect(wrapper.text()).toContain('layout.extensionStatus.optional');
  });

  it('opens on tap/click and rechecks after approving a destination', async () => {
    state.snapshot = {
      connection: 'ready',
      messageKey: 'error.extensionUnavailable',
      aggregate: 'orange',
      trackers: [requiredTracker],
    };
    const wrapper = await mountFooter();
    await wrapper.get('[data-testid="popover-trigger"]').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="extension-status-approve-req"]').trigger('click');
    expect(state.approve).toHaveBeenCalledWith('req');
    await wrapper.get('[data-testid="extension-status-recheck"]').trigger('click');
    expect(state.recheck).toHaveBeenCalled();
  });
});
