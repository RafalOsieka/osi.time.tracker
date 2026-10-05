import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import TrackerFormDialog from '../../app/components/TrackerFormDialog.vue';
import type { TrackerDto } from '../../shared/types/tracker';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const getSecretMock = vi.hoisted(() => vi.fn(() => ''));
const setSecretMock = vi.hoisted(() => vi.fn());
const putTrackerMock = vi.hoisted(() => vi.fn());

// oxlint-disable-next-line anti-slop/no-module-mocking -- `$csrfFetch` wraps the Nuxt `$fetch` global without a project DI port
vi.mock('ofetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ofetch')>();
  return {
    ...actual,
    $fetch: Object.assign(csrfFetchMock, {
      create: () => csrfFetchMock,
      raw: csrfFetchMock,
      native: csrfFetchMock,
    }),
  };
});

mockNuxtImport('useAppToast', () => () => ({
  success: toastSuccessMock,
  error: toastErrorMock,
}));
mockNuxtImport('useTrackerSecret', () => () => ({
  get: getSecretMock,
  set: setSecretMock,
  clear: vi.fn(),
}));
mockNuxtImport('useActiveTrackers', () => () => ({ putTracker: putTrackerMock }));

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
  };
});

const SelectStub = {
  props: ['modelValue', 'items'],
  emits: ['update:modelValue'],
  template: `
    <select
      v-bind="$attrs"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option>
    </select>
  `,
};

const stubs = {
  UModal: {
    props: { open: { type: Boolean, default: true }, title: { type: String, default: '' } },
    template: '<div v-if="open !== false" data-testid="tracker-dialog"><slot name="body" /></div>',
  },
  // inheritAttrs off: the parent's @submit listener would otherwise also fire on the native event.
  UForm: {
    inheritAttrs: false,
    template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>',
  },
  UFormField: { template: '<div><slot /><slot name="error" /></div>' },
  USelect: SelectStub,
  UCheckbox: {
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
    template: `
      <label>
        <input
          type="checkbox"
          v-bind="$attrs"
          :checked="modelValue"
          @change="$emit('update:modelValue', $event.target.checked)"
        />
        {{ label }}
      </label>
    `,
  },
  UTooltip: {
    props: ['text'],
    template: '<span :data-tooltip-text="text"><slot /></span>',
  },
  UButton: {
    template: '<button type="button" v-bind="$attrs"><slot /></button>',
  },
  UInput: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  FormDialogFooter: {
    template: '<button type="submit" data-testid="save-button">Save</button>',
  },
};

const existingTracker: TrackerDto = {
  id: 'tracker-1',
  name: 'Existing Tracker',
  systemType: 'redmine',
  baseUrl: 'https://rm.example.com',
  directBrowserAccess: false,
  roundingRule: 'up_15m',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

async function openDialog(tracker: TrackerDto | null) {
  const wrapper = await mountSuspended(TrackerFormDialog, {
    props: { open: false, tracker },
    global: { stubs },
  });
  await wrapper.setProps({ open: true, tracker });
  await flushPromises();
  return wrapper;
}

describe('TrackerFormDialog direct browser access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      Object.assign(useNuxtApp(), { $csrfFetch: csrfFetchMock });
    } catch {
      // ignore
    }
  });

  it('seeds create with the checkbox enabled and focusable help', async () => {
    const wrapper = await openDialog(null);
    const checkbox = wrapper.find('[data-testid="tracker-direct-browser-access"] input');
    expect(checkbox.element).toBeInstanceOf(HTMLInputElement);
    if (!(checkbox.element instanceof HTMLInputElement)) throw new Error('checkbox');
    expect(checkbox.element.checked).toBe(true);
    const help = wrapper.find('[data-testid="tracker-direct-browser-access-help"]');
    expect(help.exists()).toBe(true);
    expect(help.attributes('aria-label')).toBe('trackers.directBrowserAccessHelpAria');
    expect(help.element.closest('[data-tooltip-text]')?.getAttribute('data-tooltip-text')).toBe(
      'trackers.directBrowserAccessHelp',
    );
    expect(wrapper.find('[data-testid="tracker-extension-status"]').exists()).toBe(false);
  });

  it('seeds edit with persisted false and no extension readiness panel', async () => {
    getSecretMock.mockReturnValue('browser-secret');
    const wrapper = await openDialog(existingTracker);
    const checkbox = wrapper.find('[data-testid="tracker-direct-browser-access"] input');
    expect(checkbox.element).toBeInstanceOf(HTMLInputElement);
    if (!(checkbox.element instanceof HTMLInputElement)) throw new Error('checkbox');
    expect(checkbox.element.checked).toBe(false);
    expect(wrapper.find('[data-testid="tracker-extension-status"]').exists()).toBe(false);
  });

  it('lets the form stay savable when the extension is required and unavailable', async () => {
    const wrapper = await openDialog(null);
    await wrapper.find('[data-testid="tracker-direct-browser-access"] input').setValue(false);
    const checkbox = wrapper.find('[data-testid="tracker-direct-browser-access"] input');
    expect(checkbox.element).toBeInstanceOf(HTMLInputElement);
    if (!(checkbox.element instanceof HTMLInputElement)) throw new Error('checkbox');
    expect(checkbox.element.checked).toBe(false);
    expect(wrapper.find('[data-testid="tracker-extension-status"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="save-button"]').exists()).toBe(true);
  });
});

/** An ofetch-shaped failure carrying a server `messageKey`. */
function serverError(messageKey: string) {
  return Object.assign(new Error(messageKey), { data: { data: { messageKey } } });
}

async function fillAndSubmit(
  wrapper: Awaited<ReturnType<typeof openDialog>>,
  values: { name?: string; baseUrl?: string; secret?: string } = {},
) {
  if (values.name !== undefined) {
    await wrapper.get('[data-testid="tracker-name-input"]').setValue(values.name);
  }
  if (values.baseUrl !== undefined) {
    await wrapper.get('[data-testid="tracker-base-url-input"]').setValue(values.baseUrl);
  }
  if (values.secret !== undefined) {
    await wrapper.get('[data-testid="tracker-secret-input"]').setValue(values.secret);
  }
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

describe('TrackerFormDialog save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSecretMock.mockReturnValue('');
  });

  it('creates a tracker, keeps the entered secret in the browser and closes', async () => {
    const created: TrackerDto = { ...existingTracker, id: 'tracker-new', name: 'New Tracker' };
    csrfFetchMock.mockResolvedValue(created);
    const wrapper = await openDialog(null);

    await fillAndSubmit(wrapper, {
      name: 'New Tracker',
      baseUrl: 'https://op.example.com',
      secret: 'api-key',
    });

    expect(csrfFetchMock).toHaveBeenCalledWith('/api/trackers', {
      method: 'POST',
      body: expect.objectContaining({
        name: 'New Tracker',
        baseUrl: 'https://op.example.com',
        directBrowserAccess: true,
      }),
    });
    const [, request] = csrfFetchMock.mock.calls[0] ?? [];
    expect(JSON.stringify(request)).not.toContain('api-key');
    expect(setSecretMock).toHaveBeenCalledWith('tracker-new', 'api-key');
    expect(putTrackerMock).toHaveBeenCalledWith(created);
    expect(toastSuccessMock).toHaveBeenCalled();
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
  });

  it('does not store an empty secret', async () => {
    csrfFetchMock.mockResolvedValue({ ...existingTracker, id: 'tracker-new' });
    const wrapper = await openDialog(null);

    await fillAndSubmit(wrapper, { name: 'New Tracker', baseUrl: 'https://op.example.com' });

    expect(csrfFetchMock).toHaveBeenCalledTimes(1);
    expect(setSecretMock).not.toHaveBeenCalled();
  });

  it('updates an existing tracker by id', async () => {
    const updated: TrackerDto = { ...existingTracker, name: 'Renamed' };
    csrfFetchMock.mockResolvedValue(updated);
    const wrapper = await openDialog(existingTracker);

    await fillAndSubmit(wrapper, { name: 'Renamed' });

    expect(csrfFetchMock).toHaveBeenCalledWith(`/api/trackers/${existingTracker.id}`, {
      method: 'PATCH',
      body: expect.objectContaining({ name: 'Renamed', baseUrl: existingTracker.baseUrl }),
    });
    expect(putTrackerMock).toHaveBeenCalledWith(updated);
    expect(wrapper.emitted('saved')).toHaveLength(1);
  });

  it.each([
    ['error.trackerNameDuplicate', 'tracker-name-error'],
    ['error.trackerNameTooLong', 'tracker-name-error'],
    ['error.trackerBaseUrlInvalid', 'tracker-base-url-error'],
    ['error.trackerSystemTypeRequired', 'tracker-system-type-error'],
  ])('shows the server error %s under its field and stays open', async (key, testId) => {
    csrfFetchMock.mockRejectedValue(serverError(key));
    const wrapper = await openDialog(null);

    await fillAndSubmit(wrapper, { name: 'New Tracker', baseUrl: 'https://op.example.com' });

    expect(wrapper.get(`[data-testid="${testId}"]`).text()).toBe(key);
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(wrapper.emitted('saved')).toBeUndefined();
    expect(putTrackerMock).not.toHaveBeenCalled();
  });

  it('shows any other server error as a toast', async () => {
    csrfFetchMock.mockRejectedValue(serverError('errors.unexpected'));
    const wrapper = await openDialog(null);

    await fillAndSubmit(wrapper, { name: 'New Tracker', baseUrl: 'https://op.example.com' });

    expect(toastErrorMock).toHaveBeenCalledWith('errors.unexpected');
    expect(wrapper.find('[data-testid="tracker-name-error"]').exists()).toBe(false);
    expect(wrapper.emitted('saved')).toBeUndefined();
  });

  it('never calls the server when the re-parsed form is invalid', async () => {
    const wrapper = await openDialog(null);

    await fillAndSubmit(wrapper, { name: 'New Tracker', baseUrl: 'not a url' });

    expect(csrfFetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="tracker-base-url-error"]').exists()).toBe(true);
  });
});
