import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { createI18n } from 'vue-i18n';
import RemoteIssuePicker from '../../app/components/RemoteIssuePicker.vue';
import type { RemoteIssueRefDto } from '../../shared/types/remote-issue-ref';
import type { TrackerDto } from '../../shared/types/tracker';

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

const CheckboxStub = {
  template:
    '<label v-bind="$attrs"><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />{{ label }}</label>',
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
};

const stubs = {
  UButton: ButtonStub,
  UInput: InputStub,
  URadioGroup: RadioGroupStub,
  UPopover: PopoverStub,
  UTooltip: TooltipStub,
  UCheckbox: CheckboxStub,
};

function hintFor(wrapper: { find: (selector: string) => { element: Element } }, testid: string) {
  return wrapper
    .find(`[data-testid="${testid}"]`)
    .element.closest('[data-tooltip-text]')
    ?.getAttribute('data-tooltip-text');
}

function isChecked(wrapper: { find: (selector: string) => { element: Element } }, testid: string) {
  // SAFETY: the CheckboxStub template always renders `input type="checkbox"` for this testid.
  return (wrapper.find(`[data-testid="${testid}"] input`).element as HTMLInputElement).checked;
}

function testI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { remoteIssuePicker: { headingFor: 'Link an issue: {task}' } }, pl: {} },
    missingWarn: false,
    fallbackWarn: false,
  });
}

const config: TrackerDto = {
  id: 'config-1',
  name: 'Tracker 1',
  systemType: 'openproject',
  baseUrl: 'https://op.example.com',
  directBrowserAccess: true,
  roundingRule: 'none',
  createdAt: '',
  updatedAt: '',
};

type PickerMountProps = {
  currentRef?: RemoteIssueRefDto;
  scope?: { remoteProjectId: string; remoteProjectTitle: string } | null;
  linkTestid?: string;
  cachedTestid?: string;
  unlinkedTestid?: string;
  config?: TrackerDto;
  contextLabel?: string;
  dayLabel?: string;
};

function mount(props: PickerMountProps = {}) {
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
    expect(link.attributes('aria-label')).toContain('Fix login bug');
    expect(hintFor(wrapper, 'issue-link')).toContain('Fix login bug');
    expect(link.classes()).toContain('min-w-6');
    expect(link.classes()).toContain('h-6');
    expect(link.classes()).toContain('px-0');
    expect(link.classes()).toContain('justify-start');
    expect(wrapper.find('.group\\/ri').classes()).toContain('h-7');
    expect(wrapper.find('.group\\/ri').classes()).not.toContain('-ms-1');
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
    expect(trigger.classes()).toContain('size-7');
    expect(wrapper.find('.group\\/ri').classes()).toContain('h-7');
    expect(wrapper.find('.group\\/ri').classes()).toContain('justify-start');
    expect(trigger.classes()).not.toContain('absolute');
    expect(trigger.attributes('data-icon')).toBe('i-lucide-link');
    expect(trigger.attributes('data-size')).toBe('sm');
    expect(trigger.attributes('title')).toBeUndefined();
    expect(hintFor(wrapper, 'remote-issue-picker-trigger')).toBe('timerView.remoteIssue.unlinked');

    await trigger.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="remote-issue-picker-query"]').exists()).toBe(true);
    await flushPromises();
    expect(wrapper.find('[data-testid="remote-issue-picker-query"]').exists()).toBe(true);
  });

  it('names what it links: the heading, then the Task title in it when given', async () => {
    const wrapper = await mount({ contextLabel: 'Release 2.4 smoke test' });
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();

    const group = wrapper.find('[role="group"]');
    const heading = wrapper.find(`#${group.attributes('aria-labelledby')}`);
    expect(heading.text()).toBe('Link an issue: Release 2.4 smoke test');
    expect(heading.find('[data-testid="remote-issue-picker-context"]').text()).toBe(
      'Release 2.4 smoke test',
    );
    // Without a day it still names the Tracker the link goes to.
    expect(wrapper.find('[data-testid="remote-issue-picker-destination"]').text()).toBe(
      'Tracker 1',
    );
  });

  it('names the day whose entries a link moves, and shows the open trigger as pressed', async () => {
    const wrapper = await mount({ dayLabel: '7 listopada 2026' });
    const trigger = wrapper.find('[data-testid="remote-issue-picker-trigger"]');
    expect(trigger.attributes('aria-expanded')).toBe('false');
    await trigger.trigger('click');
    await flushPromises();

    expect(trigger.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('[data-testid="remote-issue-picker-destination"]').text()).toBe(
      'remoteIssuePicker.dayContext',
    );
    // The mode control now comes before the query field.
    const mode = wrapper.find('[data-testid="remote-issue-picker-mode"]').element;
    const query = wrapper.find('[data-testid="remote-issue-picker-query"]').element;
    expect(mode.compareDocumentPosition(query) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    // The searched text is marked inside the title.
    expect(result.find('mark').text()).toBe('login bug');

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

  it('marks the first result active and picks it on Enter for the unchanged query', async () => {
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
    expect(
      wrapper.find('[data-testid="remote-issue-picker-result-7"]').attributes('data-active'),
    ).toBe('true');

    // Enter again (the form submits) on the same query picks it instead of searching again.
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('link')?.[0]?.[0]).toMatchObject({ remoteIssueId: '7' });

    // An edited query searches again.
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('8');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it('exposes extension-unavailable on a mobile-sized viewport and does not fall back to direct search', async () => {
    const previousWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    vi.useFakeTimers();
    window.localStorage.setItem('rsc:config-1', 'secret');
    try {
      const wrapper = await mount({
        config: { ...config, directBrowserAccess: false },
      });
      await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
      await flushPromises();
      const modeButtons = wrapper
        .find('[data-testid="remote-issue-picker-mode"]')
        .findAll('button');
      await modeButtons[1]?.trigger('click');
      await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('login bug');
      await wrapper.find('form').trigger('submit');
      await vi.advanceTimersByTimeAsync(2_000);
      await flushPromises();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="tracker-extension-status"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('error.extensionUnavailable');
    } finally {
      vi.useRealTimers();
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth });
    }
  });

  it('hides the scope toggle when the project has no scope', async () => {
    const wrapper = await mount();
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="remote-issue-picker-scope-toggle"]').exists()).toBe(false);
  });

  it('shows the scope toggle on by default and applies scope on submit', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { elements: [] } }),
    });
    const wrapper = await mount({
      scope: { remoteProjectId: '3', remoteProjectTitle: 'Spike Root' },
    });
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();

    const toggle = wrapper.find('[data-testid="remote-issue-picker-scope-toggle"] input');
    expect(toggle.exists()).toBe(true);
    expect(isChecked(wrapper, 'remote-issue-picker-scope-toggle')).toBe(true);
    expect(wrapper.find('[data-testid="remote-issue-picker-scope-toggle"]').text()).toContain(
      'remoteIssuePicker.scopeToggleLabel',
    );

    const modeButtons = wrapper.find('[data-testid="remote-issue-picker-mode"]').findAll('button');
    await modeButtons[1]?.trigger('click');
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('login bug');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const [requestUrl] = fetchMock.mock.calls[0]!;
    expect(String(requestUrl)).toContain('/api/v3/projects/3/work_packages');
  });

  it('names only subprojects in a scoped search, keeping the scope in the accessible name', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        _embedded: {
          elements: [
            { id: 1, subject: 'Root issue', _links: { project: { title: 'Spike Root' } } },
            { id: 2, subject: 'Child issue', _links: { project: { title: 'Spike Child' } } },
          ],
        },
      }),
    });
    const wrapper = await mount({
      scope: { remoteProjectId: '3', remoteProjectTitle: 'Spike Root' },
    });
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    const modeButtons = wrapper.find('[data-testid="remote-issue-picker-mode"]').findAll('button');
    await modeButtons[1]?.trigger('click');
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('issue');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const root = wrapper.find('[data-testid="remote-issue-picker-result-1"]');
    expect(root.text()).not.toContain('Spike Root');
    expect(root.attributes('aria-label')).toContain('Spike Root');
    expect(wrapper.find('[data-testid="remote-issue-picker-result-2"]').text()).toContain(
      'Spike Child',
    );
  });

  it('resets the scope toggle to on when the popover reopens after being turned off', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { elements: [] } }),
    });
    const wrapper = await mount({
      scope: { remoteProjectId: '3', remoteProjectTitle: 'Spike Root' },
    });
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();

    await wrapper.find('[data-testid="remote-issue-picker-scope-toggle"] input').setValue(false);
    expect(isChecked(wrapper, 'remote-issue-picker-scope-toggle')).toBe(false);

    // Close via the popover's own dismissal (e.g. Escape/outside click), then reopen.
    await wrapper.findComponent(PopoverStub).vm.$emit('update:open', false);
    await flushPromises();
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    expect(isChecked(wrapper, 'remote-issue-picker-scope-toggle')).toBe(true);
  });

  it('widening the toggle off searches the whole tracker', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { elements: [] } }),
    });
    const wrapper = await mount({
      scope: { remoteProjectId: '3', remoteProjectTitle: 'Spike Root' },
    });
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="remote-issue-picker-scope-toggle"] input').setValue(false);

    const modeButtons = wrapper.find('[data-testid="remote-issue-picker-mode"]').findAll('button');
    await modeButtons[1]?.trigger('click');
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('login bug');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const [requestUrl] = fetchMock.mock.calls[0]!;
    expect(String(requestUrl)).not.toContain('/projects/3/');
    expect(String(requestUrl)).toContain('/api/v3/work_packages');
  });

  it('shows the outside-scope hint on an out-of-scope id-mode result and keeps it selectable', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ _embedded: { elements: [] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 39, subject: 'Unrelated wp' }),
      });
    const wrapper = await mount({
      scope: { remoteProjectId: '3', remoteProjectTitle: 'Spike Root' },
    });
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('39');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const result = wrapper.find('[data-testid="remote-issue-picker-result-39"]');
    expect(result.exists()).toBe(true);
    expect(wrapper.find('[data-testid="remote-issue-picker-out-of-scope-hint"]').exists()).toBe(
      true,
    );
    expect(result.attributes('aria-label')).toContain('remoteIssuePicker.outOfScopeHint');

    await result.trigger('click');
    expect(wrapper.emitted('link')).toEqual([
      [{ remoteIssueId: '39', cachedTitle: 'Unrelated wp', cachedRemoteProjectTitle: undefined }],
    ]);
  });

  it('shows no outside-scope hint for an in-scope id-mode result', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { elements: [{ id: 38, subject: 'Child wp' }] } }),
    });
    const wrapper = await mount({
      scope: { remoteProjectId: '3', remoteProjectTitle: 'Spike Root' },
    });
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('38');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[data-testid="remote-issue-picker-result-38"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="remote-issue-picker-out-of-scope-hint"]').exists()).toBe(
      false,
    );
  });

  it('maps a direct-mode connection failure without calling an OSI remote route', async () => {
    window.localStorage.setItem('rsc:config-1', 'secret');
    fetchMock.mockRejectedValue(new Error('network down'));
    const wrapper = await mount();
    await wrapper.find('[data-testid="remote-issue-picker-trigger"]').trigger('click');
    await flushPromises();
    const modeButtons = wrapper.find('[data-testid="remote-issue-picker-mode"]').findAll('button');
    await modeButtons[1]?.trigger('click');
    await wrapper.find('[data-testid="remote-issue-picker-query"]').setValue('login bug');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalled();
    expect(wrapper.text()).toContain('error.remoteTrackerConnectionFailed');
  });
});
