import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import TimerTaskEditorDialog from '../../app/components/TimerTaskEditorDialog.vue';

const csrfFetchMock = vi.fn();

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

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  };
});

const toastAddMock = vi.fn();
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAddMock }),
}));

const InputTextStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" :aria-invalid="ariaInvalid" :aria-describedby="ariaDescribedby" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  props: ['modelValue', 'placeholder', 'ariaInvalid', 'ariaDescribedby'],
  emits: ['update:modelValue'],
};
const SelectStub = {
  template:
    '<select v-bind="$attrs" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="opt in options" :key="opt.id" :value="opt.id">{{ opt.name }}</option></select>',
  props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder', 'showClear'],
  emits: ['update:modelValue'],
};
const DialogStub = {
  template: '<div v-if="visible" data-testid="timer-task-editor-dialog"><slot /></div>',
  props: ['visible', 'header', 'modal', 'closable'],
  emits: ['update:visible'],
};

const commonStubs = {
  Dialog: DialogStub,
  InputText: InputTextStub,
  Select: SelectStub,
};

describe('TimerTaskEditorDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks submission and does not call the server when name is empty', async () => {
    const wrapper = await mountSuspended(TimerTaskEditorDialog, {
      props: {
        visible: true,
        task: { id: 'task-1', name: '', projectId: null, projectName: null },
        projectOptions: [],
      },
      global: { stubs: commonStubs },
    });

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(csrfFetchMock).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="timer-task-editor-name-error"]').exists()).toBe(true);
  });

  it('seeds a missing (soft-deleted) project option so it remains selectable', async () => {
    const wrapper = await mountSuspended(TimerTaskEditorDialog, {
      props: {
        visible: true,
        task: {
          id: 'task-1',
          name: 'Task One',
          projectId: 'deleted-project',
          projectName: 'Deleted Project',
        },
        projectOptions: [],
      },
      global: { stubs: commonStubs },
    });
    await flushPromises();

    const select = wrapper.find('[data-testid="timer-task-editor-project-select"]');
    const option = select.find('option[value="deleted-project"]');
    expect(option.exists()).toBe(true);
    expect(option.text()).toBe('Deleted Project');
  });

  it('submits a valid rename to the server', async () => {
    csrfFetchMock.mockResolvedValue({
      id: 'task-1',
      name: 'Renamed',
      projectId: null,
      projectName: null,
      clientName: null,
      createdAt: new Date().toISOString(),
    });

    const wrapper = await mountSuspended(TimerTaskEditorDialog, {
      props: {
        visible: true,
        task: { id: 'task-1', name: 'Task One', projectId: null, projectName: null },
        projectOptions: [],
      },
      global: { stubs: commonStubs },
    });

    await wrapper.find('[data-testid="timer-task-editor-name-input"]').setValue('Renamed');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(csrfFetchMock).toHaveBeenCalledWith(
      '/api/tasks/task-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
