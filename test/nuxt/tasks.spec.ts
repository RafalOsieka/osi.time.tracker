import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import TasksPage from '../../app/pages/tasks.vue';

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

type Project = {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  createdAt: string;
};
type Task = {
  id: string;
  number: number;
  name: string;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  createdAt: string;
};

let mockProjects: Project[] = [];
let mockTasks: Task[] = [];

mockNuxtImport('useAsyncData', () => {
  return (key: string, fetcher: () => Promise<Project[] | Task[]>) => {
    const initial = key === 'projects-for-tasks' ? mockProjects : mockTasks;
    const data = ref<Project[] | Task[]>(initial);
    fetcher()
      .then((result) => {
        data.value = result;
      })
      .catch(() => {});
    return { data, pending: ref(false), refresh: vi.fn().mockResolvedValue(undefined) };
  };
});

// Mock vue-i18n
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  };
});

// Mock PrimeVue composables
const confirmRequireMock = vi.fn();
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({ require: confirmRequireMock }),
}));

const toastAddMock = vi.fn();
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAddMock }),
}));

// Stubs for PrimeVue components
const ButtonStub = {
  template:
    '<button v-bind="$attrs" :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  props: ['label', 'icon', 'loading', 'text', 'rounded', 'severity', 'type'],
  emits: ['click'],
};
const InputTextStub = {
  template:
    '<input v-bind="$attrs" :value="modelValue" :aria-invalid="ariaInvalid" :aria-describedby="ariaDescribedby" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  props: ['modelValue', 'placeholder', 'ariaInvalid', 'ariaDescribedby'],
  emits: ['update:modelValue'],
};
const SelectStub = {
  template:
    '<select v-bind="$attrs" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="opt in options" :key="opt.id" :value="opt.id">{{ opt.name }}</option></select>',
  props: [
    'modelValue',
    'options',
    'optionLabel',
    'optionValue',
    'placeholder',
    'showClear',
    'loading',
  ],
  emits: ['update:modelValue'],
};
const DataTableStub = {
  template: `
    <div data-testid="tasks-table">
      <slot name="header" />
      <slot name="empty" v-if="!value || value.length === 0" />
      <div v-for="row in (value || [])" :key="row.id" data-testid="tasks-row">#{{ row.number }} {{ row.name }} {{ row.projectName }}</div>
    </div>
  `,
  props: ['value', 'dataKey', 'sortField', 'sortOrder'],
};
const ColumnStub = {
  template: '<div><slot name="body" :data="{}" /></div>',
  props: ['field', 'header', 'sortable'],
};
const DialogStub = {
  template: '<div v-if="visible" data-testid="task-dialog"><slot /></div>',
  props: ['visible', 'header', 'modal', 'closable'],
  emits: ['update:visible', 'hide'],
};
const ConfirmDialogStub = { template: '<div />' };

const commonStubs = {
  DataTable: DataTableStub,
  Column: ColumnStub,
  Dialog: DialogStub,
  ConfirmDialog: ConfirmDialogStub,
  Button: ButtonStub,
  InputText: InputTextStub,
  Select: SelectStub,
};

describe('tasks page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjects = [];
    mockTasks = [];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (useNuxtApp() as any).$csrfFetch = csrfFetchMock;
    } catch {
      // ignore
    }
  });

  it('4.5a renders empty state when no tasks', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]));
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(TasksPage, {
      global: { stubs: commonStubs },
    });

    expect(wrapper.find('[data-testid="tasks-page"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tasks-empty-state"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="new-task-button"]').exists()).toBe(true);
  });

  it('4.5b create dialog opens with a labelled Project select', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]));
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(TasksPage, {
      global: { stubs: commonStubs },
    });

    expect(wrapper.find('[data-testid="task-dialog"]').exists()).toBe(false);
    await wrapper.find('[data-testid="new-task-button"]').trigger('click');
    expect(wrapper.find('[data-testid="task-dialog"]').exists()).toBe(true);
    expect(wrapper.find('label[for="task-project"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="task-project-select"]').exists()).toBe(true);
  });

  it('4.5c edit dialog seeds a missing project option for a soft-deleted project', async () => {
    mockProjects = [];
    mockTasks = [
      {
        id: '1',
        number: 1,
        name: 'Orphaned Task',
        projectId: 'deleted-project',
        projectName: 'Deleted Project',
        clientName: 'Some Client',
        createdAt: new Date().toISOString(),
      },
    ];
    vi.stubGlobal(
      '$fetch',
      vi.fn((url: string) => Promise.resolve(url.includes('projects') ? mockProjects : mockTasks)),
    );
    csrfFetchMock.mockResolvedValue({});

    const wrapper = await mountSuspended(TasksPage, {
      global: { stubs: commonStubs },
    });
    await flushPromises();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (wrapper.vm as any).openEdit(mockTasks[0]);
    await flushPromises();

    const select = wrapper.find('[data-testid="task-project-select"]');
    expect(select.exists()).toBe(true);
    const option = select.find('option[value="deleted-project"]');
    expect(option.exists()).toBe(true);
    expect(option.text()).toBe('Deleted Project');
    expect((select.element as HTMLSelectElement).value).toBe('deleted-project');
  });

  it('4.5d inline field error exposes aria-invalid and aria-describedby on save failure', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([]));
    csrfFetchMock.mockRejectedValue({
      data: {
        data: { messageKey: 'error.taskNameRequired' },
      },
    });

    const wrapper = await mountSuspended(TasksPage, {
      global: { stubs: commonStubs },
    });

    // Open dialog
    await wrapper.find('[data-testid="new-task-button"]').trigger('click');
    expect(wrapper.find('[data-testid="task-dialog"]').exists()).toBe(true);

    // Submit form
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const errorEl = wrapper.find('[data-testid="task-name-error"]');
    expect(errorEl.exists()).toBe(true);

    const input = wrapper.find('[data-testid="task-name-input"]');
    expect(input.attributes('aria-invalid')).toBe('true');
    expect(input.attributes('aria-describedby')).toBe('task-name-error');
  });
});
