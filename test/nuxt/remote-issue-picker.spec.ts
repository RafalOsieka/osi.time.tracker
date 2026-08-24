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
  template: `
    <component
      :is="to ? 'a' : 'button'"
      v-bind="$attrs"
      :href="to"
      :target="target"
      :type="to ? undefined : type || 'button'"
      :aria-label="ariaLabel || $attrs['aria-label']"
      :disabled="disabled"
      :data-icon="icon"
      :data-size="size"
      @click="$emit('click', $event)"
    >{{ label }}<slot /></component>
  `,
  props: [
    'label',
    'ariaLabel',
    'icon',
    'variant',
    'color',
    'square',
    'size',
    'disabled',
    'type',
    'to',
    'target',
    'external',
  ],
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

const TooltipStub = {
  props: ['text', 'content'],
  template: '<span v-bind="$attrs" :data-tooltip-text="text"><slot /></span>',
};

const stubs = {
  UButton: ButtonStub,
  UInput: InputStub,
  URadioGroup: RadioGroupStub,
  UPopover: PopoverStub,
  UTooltip: TooltipStub,
};

function hintFor(wrapper: { find: (selector: string) => { element: Element } }, testid: string) {
  return wrapper
    .find(`[data-testid="${testid}"]`)
    .element.closest('[data-tooltip-text]')
    ?.getAttribute('data-tooltip-text');
}

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
  name: 'Tracker 1',
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

  it('shows a remote-issue link and keeps the edit trigger when a reference exists', async () => {
    const wrapper = await mount({
      currentRef: {
        id: 'ref-1',
        taskId: 'task-1',
        userId: 'user-1',
        trackerId: 'config-1',
        remoteIssueId: '42',
        cachedTitle: 'Fix login bug',
        url: 'https://op.example.com/work_packages/42',
        createdAt: '',
        updatedAt: '',
      },
      linkTestid: 'issue-link',
    });
    const link = wrapper.find('[data-testid="issue-link"]');
    expect(link.attributes('href')).toBe('https://op.example.com/work_packages/42');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('title')).toBeUndefined();
    expect(hintFor(wrapper, 'issue-link')).toContain('Fix login bug');
    expect(link.classes()).toContain('min-w-6');
    expect(link.classes()).toContain('h-6');
    expect(link.classes()).toContain('px-0');
    expect(wrapper.find('.group\\/ri').classes()).toContain('h-6');
    const menu = wrapper.find('[data-testid="remote-issue-picker-edit-menu"]');
    expect(menu.exists()).toBe(true);
    expect(menu.classes()).toContain('absolute');
    expect(menu.classes()).toContain('top-full');
    const trigger = wrapper.find('[data-testid="remote-issue-picker-trigger"]');
    expect(trigger.exists()).toBe(true);
    expect(trigger.text()).toContain('timerView.editLabel');
    expect(trigger.classes()).not.toContain('absolute');
  });

  it('keeps the unlinked trigger in flow and leaves the popover open after click', async () => {
    const wrapper = await mount();
    const trigger = wrapper.find('[data-testid="remote-issue-picker-trigger"]');
    expect(trigger.classes()).toContain('shrink-0');
    expect(trigger.classes()).toContain('w-6');
    expect(trigger.classes()).toContain('h-6');
    expect(wrapper.find('.group\\/ri').classes()).toContain('h-6');
    expect(trigger.classes()).not.toContain('absolute');
    expect(trigger.attributes('data-icon')).toBe('i-lucide-link-2-off');
    expect(trigger.attributes('data-size')).toBe('xs');
    expect(trigger.attributes('title')).toBeUndefined();
    expect(hintFor(wrapper, 'remote-issue-picker-trigger')).toBe('timerView.remoteIssue.unlinked');

    await trigger.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="remote-issue-picker-query"]').exists()).toBe(true);
    await flushPromises();
    expect(wrapper.find('[data-testid="remote-issue-picker-query"]').exists()).toBe(true);
  });

  it('defaults to issue-ID search and hides empty results until a search', async () => {
    const wrapper = await mount();
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();

    const modeButtons = wrapper.find('[data-testid="remote-issue-picker-mode"]').findAll('button');
    expect(modeButtons[0]?.attributes('aria-pressed')).toBe('true');
    expect(modeButtons[0]?.text()).toContain('remoteIssuePicker.modeId');
    expect(wrapper.text()).not.toContain('remoteIssuePicker.emptyResults');
    expect(wrapper.find('[data-testid="remote-issue-picker-unlink"]').exists()).toBe(false);
  });

  it('opens the popover and emits link on selecting a title-search result', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        _embedded: {
          elements: [
            {
              id: 42,
              subject: 'Fix login bug',
              _links: { project: { title: 'Acme Intranet' } },
            },
          ],
        },
      }),
    });
    const wrapper = await mount();
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    const modeButtons = wrapper.find('[data-testid="remote-issue-picker-mode"]').findAll('button');
    await modeButtons[1]?.trigger('click');
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('login bug');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const result = wrapper.find('[data-testid="remote-issue-picker-result-42"]');
    expect(result.text()).toContain('Fix login bug');
    expect(result.text()).toContain('Acme Intranet');

    await result.trigger('click');
    expect(wrapper.emitted('link')).toEqual([
      [
        {
          remoteIssueId: '42',
          cachedTitle: 'Fix login bug',
          cachedRemoteProjectTitle: 'Acme Intranet',
        },
      ],
    ]);
  });

  it('selects a result via keyboard (Enter)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 7, subject: 'Closed issue' }),
    });
    const wrapper = await mount();
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('7');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const result = wrapper.find('[data-testid="remote-issue-picker-result-7"]');
    await result.trigger('click');
    expect(wrapper.emitted('link')).toEqual([
      [{ remoteIssueId: '7', cachedTitle: 'Closed issue', cachedRemoteProjectTitle: undefined }],
    ]);
  });

  it('does not call fetch for a too-short title query and shows a validation message', async () => {
    const wrapper = await mount();
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    const modeButtons = wrapper.find('[data-testid="remote-issue-picker-mode"]').findAll('button');
    await modeButtons[1]?.trigger('click');
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('ab');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('error.remoteIssueSearchTitleTooShort');
  });

  it('puts unlink in the linked dropdown and not in the popover', async () => {
    const wrapper = await mount({
      currentRef: {
        id: 'ref-1',
        taskId: 'task-1',
        userId: 'user-1',
        trackerId: 'config-1',
        remoteIssueId: '10',
        cachedTitle: 'Existing',
        url: 'https://op.example.com/work_packages/10',
        createdAt: '',
        updatedAt: '',
      },
    });

    const unlinkButton = wrapper.find('[data-testid="remote-issue-picker-unlink"]');
    expect(unlinkButton.exists()).toBe(true);
    expect(wrapper.find('[data-testid="remote-issue-picker-edit-menu"]').exists()).toBe(true);
    await unlinkButton.trigger('click');
    expect(wrapper.emitted('unlink')).toHaveLength(1);

    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="popover-content"]').exists()).toBe(true);
    expect(
      wrapper
        .find('[data-testid="popover-content"] [data-testid="remote-issue-picker-unlink"]')
        .exists(),
    ).toBe(false);
  });
});
