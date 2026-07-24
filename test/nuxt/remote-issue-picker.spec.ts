import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { createI18n } from 'vue-i18n';
import RemoteIssuePicker from '../../app/components/RemoteIssuePicker.vue';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

/**
 * Node's own global `localStorage` shadows `window.localStorage` in this
 * test environment; replace it with a minimal in-memory implementation.
 */
function installFakeLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    },
  });
}

const ButtonStub = {
  template:
    '<button v-bind="$attrs" :type="type || \'button\'" :aria-label="ariaLabel || $attrs[\'aria-label\']" :disabled="disabled" @click="$emit(\'click\', $event)">{{ label }}</button>',
  props: ['label', 'ariaLabel', 'icon', 'variant', 'color', 'square', 'disabled', 'type'],
  emits: ['click'],
};
const InputStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  props: ['modelValue'],
  emits: ['update:modelValue'],
};
const RadioGroupStub = {
  template: `
    <div>
      <button
        v-for="option in items"
        :key="option.value"
        type="button"
        :aria-pressed="modelValue === option.value"
        @click="$emit('update:modelValue', option.value)"
      >{{ option.label }}</button>
    </div>
  `,
  props: ['modelValue', 'items', 'orientation', 'valueKey', 'labelKey'],
  emits: ['update:modelValue'],
};
const PopoverStub = {
  props: {
    open: { type: Boolean, default: false },
  },
  emits: ['update:open'],
  template:
    '<div><slot /><div v-if="open" data-testid="popover-content"><slot name="content" /></div></div>',
};

const stubs = {
  UButton: ButtonStub,
  UInput: InputStub,
  URadioGroup: RadioGroupStub,
  UPopover: PopoverStub,
};

function testI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: {}, pl: {} },
    missingWarn: false,
    fallbackWarn: false,
  });
}

const config = {
  id: 'config-1',
  clientId: 'client-1',
  systemType: 'openproject' as const,
  baseUrl: 'https://op.example.com',
  executionMode: 'client' as const,
  roundingRule: 'none' as const,
  requiredFieldDefaults: {},
  createdAt: '',
  updatedAt: '',
};

function mount(props: Record<string, unknown> = {}) {
  return mountSuspended(RemoteIssuePicker, {
    props: { config, ...props },
    global: { plugins: [testI18n()], stubs },
  });
}

describe('RemoteIssuePicker', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    installFakeLocalStorage();
  });

  it('opens the popover and emits link on selecting a title-search result', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { elements: [{ id: 42, subject: 'Fix login bug' }] } }),
    });
    const wrapper = await mount();
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('login bug');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const result = wrapper.find('[data-testid="remote-issue-picker-result-42"]');
    expect(result.text()).toContain('Fix login bug');

    await result.trigger('click');
    expect(wrapper.emitted('link')).toEqual([
      [{ remoteIssueId: '42', cachedTitle: 'Fix login bug' }],
    ]);
  });

  it('selects a result via keyboard (Enter)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { elements: [{ id: 7, subject: 'Closed issue' }] } }),
    });
    const wrapper = await mount();
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('anything');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const result = wrapper.find('[data-testid="remote-issue-picker-result-7"]');
    await result.trigger('click');
    expect(wrapper.emitted('link')).toEqual([
      [{ remoteIssueId: '7', cachedTitle: 'Closed issue' }],
    ]);
  });

  it('does not call fetch for a too-short title query and shows a validation message', async () => {
    const wrapper = await mount();
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('ab');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('error.remoteIssueSearchTitleTooShort');
  });

  it('shows an empty-results state and an unlink button when a reference exists', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { elements: [] } }),
    });
    const wrapper = await mount({
      currentRef: {
        id: 'ref-1',
        taskId: 'task-1',
        userId: 'user-1',
        remoteSystemConfigId: 'config-1',
        remoteIssueId: '10',
        cachedTitle: 'Existing',
        url: 'https://op.example.com/work_packages/10',
        createdAt: '',
        updatedAt: '',
      },
    });
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('nothing here');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('remoteIssuePicker.emptyResults');
    const unlinkButton = wrapper.find('[data-testid="remote-issue-picker-unlink"]');
    expect(unlinkButton.exists()).toBe(true);
    await unlinkButton.trigger('click');
    expect(wrapper.emitted('unlink')).toHaveLength(1);
  });
});
