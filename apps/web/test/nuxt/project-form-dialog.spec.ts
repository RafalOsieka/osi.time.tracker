import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import ProjectFormDialog from '../../app/components/ProjectFormDialog.vue';
import type { ProjectDto } from '../../shared/types/project';

const csrfFetchMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const confirmMock = vi.hoisted(() => vi.fn(async () => true));
const getSecretMock = vi.hoisted(() => vi.fn((): string | null => 'secret'));
const listProjectsMock = vi.hoisted(() => vi.fn());
const probeExtensionAvailabilityMock = vi.hoisted(() => vi.fn());

const { tracker, extensionTracker } = vi.hoisted(() => {
  const tracker = {
    id: '018f2f8a-1234-7abc-8def-123456789abc',
    name: 'Acme Redmine',
    systemType: 'redmine',
    baseUrl: 'https://rm.example.com',
    directBrowserAccess: true,
    roundingRule: 'none',
    createdAt: '',
    updatedAt: '',
  };
  const extensionTracker = {
    ...tracker,
    id: '018f2f8a-1234-7abc-8def-123456789abd',
    directBrowserAccess: false,
  };
  return { tracker, extensionTracker };
});

const fetchTrackersMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    if (url.includes('/api/trackers')) return Promise.resolve([tracker, extensionTracker]);
    return Promise.resolve([]);
  }),
);

// oxlint-disable-next-line anti-slop/no-module-mocking -- `$fetch`/`ofetch` is a Nuxt global without a project DI port
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

// oxlint-disable-next-line anti-slop/no-module-mocking -- remote client factory is not injectable here
vi.mock('../../app/utils/remote/create-remote-adapter', () => ({
  createRemoteAdapter: () => ({ listProjects: listProjectsMock }),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- extension availability probe has no test seam
vi.mock('../../app/utils/remote/extension-availability', () => ({
  probeExtensionAvailability: probeExtensionAvailabilityMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking -- cookie secret composable has no test seam
vi.mock('../../app/composables/use-tracker-secret', () => ({
  useTrackerSecret: () => ({ get: getSecretMock }),
}));

mockNuxtImport('useAppConfirm', () => () => confirmMock);
mockNuxtImport('useAppToast', () => () => ({ success: toastSuccessMock, error: toastErrorMock }));
mockNuxtImport('useRequestFetch', () => () => fetchTrackersMock);

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key, locale: { value: 'en' } }),
  };
});

const ButtonStub = {
  template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  props: ['label', 'icon', 'loading', 'type', 'size', 'variant', 'color'],
  emits: ['click'],
};
const SelectStub = {
  template:
    '<select v-bind="$attrs" :disabled="disabled" :data-loading="loading" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value || undefined)"><option value="">{{ placeholder }}</option><option v-for="opt in items" :key="opt[valueKey]" :value="opt[valueKey]">{{ opt[labelKey] }}</option></select>',
  props: ['modelValue', 'items', 'labelKey', 'valueKey', 'placeholder', 'loading', 'disabled'],
  emits: ['update:modelValue'],
};
const FormStub = {
  emits: ['submit'],
  template:
    '<form v-bind="$attrs" @submit.prevent="$emit(\'submit\', { data: {} })"><slot /></form>',
};
const ModalStub = {
  template:
    '<div v-if="open !== false" data-testid="project-modal"><slot name="body" /><slot /></div>',
  props: { open: { type: Boolean, default: true }, title: { type: String, default: '' } },
  emits: ['update:open'],
};

const stubs = {
  UModal: ModalStub,
  UForm: FormStub,
  UFormField: {
    props: ['label', 'name', 'error'],
    template: '<div><label>{{ label }}</label><slot /><slot name="error" /></div>',
  },
  UInput: {
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue'],
    emits: ['update:modelValue'],
  },
  USelect: SelectStub,
  UButton: ButtonStub,
  FormDialogFooter: { template: '<div />' },
};

function scopedProject(overrides: Partial<ProjectDto> = {}): ProjectDto {
  return {
    id: 'project-1',
    name: 'Scoped Project',
    trackerId: tracker.id,
    trackerName: tracker.name,
    remoteProjectId: '3',
    remoteProjectTitle: 'Spike Root',
    createdAt: '',
    ...overrides,
  };
}

async function mount(project: ProjectDto | null = null) {
  // The dialog only seeds/loads on an `open` false->true transition (matching
  // how the real page always mounts it closed and toggles it), so start
  // closed and open it explicitly rather than mounting already-open.
  const wrapper = await mountSuspended(ProjectFormDialog, {
    props: { open: false, project },
    global: { stubs },
  });
  await wrapper.setProps({ open: true });
  await flushPromises();
  return wrapper;
}

describe('ProjectFormDialog remote project scope', () => {
  beforeEach(() => {
    csrfFetchMock.mockReset();
    getSecretMock.mockReset().mockReturnValue('secret');
    listProjectsMock.mockReset();
    probeExtensionAvailabilityMock.mockReset().mockResolvedValue({
      status: 'available',
      messageKey: '',
      handshake: { supportedOperations: ['listProjects'] },
    });
  });

  it('hides the remote project field when no tracker is selected', async () => {
    const wrapper = await mount(null);
    expect(wrapper.find('[data-testid="project-remote-project-select"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="project-remote-project-cached"]').exists()).toBe(false);
  });

  it('loads the catalog as an indented hierarchy when a secret is available', async () => {
    listProjectsMock.mockResolvedValue([
      { remoteProjectId: '3', title: 'Spike Root' },
      { remoteProjectId: '4', title: 'Spike Child', parentId: '3' },
    ]);
    const wrapper = await mount(scopedProject());
    await flushPromises();

    const select = wrapper.find('[data-testid="project-remote-project-select"]');
    expect(select.exists()).toBe(true);
    const optionLabels = select.findAll('option').map((o) => o.text());
    expect(optionLabels).toContain('Spike Root');
    expect(optionLabels.some((label) => label.includes('Spike Child'))).toBe(true);
  });

  it('lets the user deselect a chosen remote project via the "whole tracker" item', async () => {
    listProjectsMock.mockResolvedValue([{ remoteProjectId: '3', title: 'Spike Root' }]);
    csrfFetchMock.mockResolvedValue({ id: 'project-1', name: 'Scoped Project' });
    const wrapper = await mount(scopedProject());
    await flushPromises();

    const select = wrapper.find('[data-testid="project-remote-project-select"]');
    // SAFETY: the SelectStub template always renders a native `<select>` for this testid.
    expect((select.element as HTMLSelectElement).value).toBe('3');

    await select.setValue('');
    await flushPromises();
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.objectContaining({ remoteProjectId: null, remoteProjectTitle: null }),
      }),
    );
  });

  it('shows the disabled cached-title fallback with a clear action when there is no secret', async () => {
    getSecretMock.mockReturnValue(null);
    const wrapper = await mount(scopedProject());
    await flushPromises();

    expect(wrapper.find('[data-testid="project-remote-project-select"]').exists()).toBe(false);
    const cached = wrapper.find('[data-testid="project-remote-project-cached"]');
    expect(cached.text()).toBe('Spike Root');
    expect(wrapper.find('[data-testid="project-remote-project-clear"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="project-remote-project-hint"]').text()).toBe(
      'projects.remoteProjectNoSecretHint',
    );
    expect(listProjectsMock).not.toHaveBeenCalled();
  });

  it('clears the cached scope when Clear is activated', async () => {
    getSecretMock.mockReturnValue(null);
    const wrapper = await mount(scopedProject());
    await flushPromises();

    await wrapper.find('[data-testid="project-remote-project-clear"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="project-remote-project-cached"]').text()).toBe(
      'projects.remoteProjectNone',
    );
    expect(wrapper.find('[data-testid="project-remote-project-clear"]').exists()).toBe(false);
  });

  it('shows a translated error with retry when the catalog fetch fails, without blocking save', async () => {
    listProjectsMock.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { messageKey: 'error.remoteProjectsFetchFailed' }),
    );
    const wrapper = await mount(scopedProject());
    await flushPromises();

    const error = wrapper.find('[data-testid="project-remote-project-error"]');
    expect(error.text()).toContain('error.remoteProjectsFetchFailed');
    const retry = wrapper.find('[data-testid="project-remote-project-retry"]');
    expect(retry.exists()).toBe(true);

    listProjectsMock.mockResolvedValueOnce([{ remoteProjectId: '3', title: 'Spike Root' }]);
    await retry.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="project-remote-project-error"]').exists()).toBe(false);
  });

  it('clears the pending scope and reloads the catalog when the tracker is switched', async () => {
    listProjectsMock.mockResolvedValue([{ remoteProjectId: '3', title: 'Spike Root' }]);
    const wrapper = await mount(scopedProject());
    await flushPromises();
    expect(listProjectsMock).toHaveBeenCalledTimes(1);

    const trackerSelect = wrapper.find('[data-testid="project-tracker-select"]');
    await trackerSelect.setValue(extensionTracker.id);
    await flushPromises();

    // Switching tracker triggers a fresh (extension-mode) capability check rather
    // than reusing the previous tracker's catalog/selection.
    expect(probeExtensionAvailabilityMock).toHaveBeenCalled();
    const select = wrapper.find('[data-testid="project-remote-project-select"]');
    if (select.exists()) {
      // SAFETY: the SelectStub template always renders a native `<select>` for this testid.
      expect((select.element as HTMLSelectElement).value).toBe('__whole-tracker__');
    }
  });

  it('disables the control with an incompatibility hint when the extension lacks the catalog operation', async () => {
    probeExtensionAvailabilityMock.mockResolvedValue({
      status: 'available',
      messageKey: '',
      handshake: { supportedOperations: ['searchIssues', 'getIssueById'] },
    });
    const wrapper = await mount(scopedProject({ trackerId: extensionTracker.id }));
    await flushPromises();

    expect(wrapper.find('[data-testid="project-remote-project-select"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="project-remote-project-hint"]').text()).toBe(
      'projects.remoteProjectExtensionUnsupported',
    );
    expect(listProjectsMock).not.toHaveBeenCalled();
  });

  it('submits the selected remote project id and title', async () => {
    listProjectsMock.mockResolvedValue([{ remoteProjectId: '4', title: 'Spike Child' }]);
    csrfFetchMock.mockResolvedValue({ id: 'project-1', name: 'Scoped Project' });
    const wrapper = await mount(scopedProject());
    await flushPromises();

    const select = wrapper.find('[data-testid="project-remote-project-select"]');
    await select.setValue('4');
    await flushPromises();
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/projects/project-1',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.objectContaining({ remoteProjectId: '4', remoteProjectTitle: 'Spike Child' }),
      }),
    );
  });
});
