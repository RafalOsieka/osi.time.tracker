import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { ref } from 'vue';
import TaskTitleInput from '../../app/components/TaskTitleInput.vue';
import type { TitleProject, TitleTask } from '../../app/utils/title-mention';

/** Matches `SUGGESTION_DEBOUNCE_MS` in `use-task-suggestions.ts`. */
const SUGGESTION_DEBOUNCE_MS = 200;

async function settleSuggestions() {
  await vi.advanceTimersByTimeAsync(SUGGESTION_DEBOUNCE_MS);
  await flushPromises();
}

const fetchMock = vi.hoisted(() => vi.fn());

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt i18n is not injectable in this nuxt test
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

mockNuxtImport('$fetch', () => fetchMock);

type MenuRow = {
  id: string;
  name: string;
  label: string;
  type?: string;
  onSelect: () => void;
};

const InputMenuStub = {
  inheritAttrs: false,
  template: `
    <div>
      <input
        v-bind="$attrs"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value); $emit('update:searchTerm', $event.target.value)"
        @focus="$emit('focus')"
        @blur="$emit('blur')"
        @keydown.enter="$emit('keydown', $event)"
      />
      <slot name="leading" />
    </div>
  `,
  props: ['modelValue', 'searchTerm', 'items', 'disabled', 'placeholder', 'mode', 'open', 'ui'],
  emits: ['update:modelValue', 'update:searchTerm', 'update:open', 'focus', 'blur', 'keydown'],
};
const ButtonStub = {
  template:
    '<button :data-testid="$attrs[\'data-testid\']" :aria-label="$attrs[\'aria-label\']" @click="$emit(\'click\')" />',
  emits: ['click'],
};

const helios = {
  id: 'p-helios',
  name: 'Helios',
  trackerId: null,
  trackerName: 'Acme',
  remoteProjectId: null,
  remoteProjectTitle: null,
  recentTrackedSeconds: 100,
  createdAt: '',
};
const nordwind = { ...helios, id: 'p-nord', name: 'Nordwind', trackerName: null };
const suggestion = {
  id: 'task-7',
  name: 'fix login',
  projectId: 'p-nord',
  projectName: 'Nordwind',
  createdAt: '',
};

/** Mounts the input with its three models held in refs, like a real caller. */
async function mountInput(tasks: unknown[] = [], projects = [helios, nordwind]) {
  fetchMock.mockImplementation(async (path: string) =>
    path === '/api/projects' ? projects : tasks,
  );
  const text = ref('');
  const project = ref<TitleProject | null>(null);
  const task = ref<TitleTask | null>(null);
  const events = {
    pickProject: vi.fn(),
    removeProject: vi.fn(),
    pickTask: vi.fn(),
    blur: vi.fn(),
    enter: vi.fn(),
  };
  const wrapper = await mountSuspended(TaskTitleInput, {
    props: {
      chipTestid: 'chip',
      text: text.value,
      'onUpdate:text': (value: string) => (text.value = value),
      project: project.value,
      'onUpdate:project': (value: TitleProject | null) => (project.value = value),
      task: task.value,
      'onUpdate:task': (value: TitleTask | null) => (task.value = value),
      onPickProject: events.pickProject,
      onRemoveProject: events.removeProject,
      onPickTask: events.pickTask,
      onBlur: events.blur,
      onEnter: events.enter,
    },
    global: { stubs: { UInputMenu: InputMenuStub, UButton: ButtonStub } },
  });
  // Keep the props in sync with the refs the way a parent's v-model would.
  const sync = async () => {
    await wrapper.setProps({ text: text.value, project: project.value, task: task.value });
    await flushPromises();
  };
  const menu = wrapper.findComponent(InputMenuStub);
  await menu.vm.$emit('focus');
  await flushPromises();
  // SAFETY: the stubbed menu receives the items built by buildTaskTitleMenuItems.
  const rows = () => menu.props('items') as MenuRow[];
  const type = async (value: string) => {
    await wrapper.find('input').setValue(value);
    await sync();
  };
  return { wrapper, menu, rows, type, sync, text, project, task, events };
}

describe('TaskTitleInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('switches to project mode for @, shows tracker context, and falls back when nothing matches', async () => {
    const { rows, type } = await mountInput();

    await type('fix login @hel');
    expect(rows().map((r) => r.label)).toEqual(['timer.mention.projectsLabel', 'Helios · Acme']);
    expect(rows()[1]?.name).toBe('fix login');
    expect(rows().some((r) => r.id === '__create_new_task__')).toBe(false);

    await type('fix login @zzz');
    expect(rows().some((r) => r.id === '__create_new_task__')).toBe(true);
    expect(rows().some((r) => r.type === 'label')).toBe(false);

    await type('mail jan@firma.pl');
    expect(rows().some((r) => r.type === 'label')).toBe(false);
  });

  it('caps the project list at five, most used first', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...helios,
      id: `p${i}`,
      name: `Proj ${i}`,
      recentTrackedSeconds: i,
    }));
    const { rows, type } = await mountInput([], many);

    await type('@');
    expect(rows()).toHaveLength(6);
    expect(rows()[1]?.label).toBe('Proj 7 · Acme');
  });

  it('picking a project strips the token, sets the chip and reports it', async () => {
    const { wrapper, menu, rows, type, sync, text, events } = await mountInput();

    await type('fix login @hel');
    const picked = rows()[1]!;
    picked.onSelect();
    await menu.vm.$emit('update:modelValue', picked.name);
    await sync();

    expect(text.value).toBe('fix login');
    expect(events.pickProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p-helios' }),
      'fix login',
    );
    expect(wrapper.find('[data-testid="chip-chip"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="chip-chip"]').text()).toContain('Helios');
  });

  it('removing the chip clears the project and reports it', async () => {
    const { wrapper, project, sync, events } = await mountInput();
    project.value = { id: 'p-helios', name: 'Helios' };
    await sync();

    const remove = wrapper.find('[data-testid="chip-chip-remove"]');
    expect(remove.attributes('aria-label')).toBe('timer.mention.removeProject');
    await remove.trigger('click');
    await sync();

    expect(project.value).toBeNull();
    expect(events.removeProject).toHaveBeenCalled();
  });

  it('restricts suggestions to the chip project and names it in the create row', async () => {
    const { rows, type, project, sync } = await mountInput();
    project.value = { id: 'p-helios', name: 'Helios' };
    await sync();
    fetchMock.mockClear();

    await type('fix');
    await settleSuggestions();

    expect(fetchMock).toHaveBeenCalledWith('/api/tasks', {
      query: { search: 'fix', projectId: 'p-helios' },
    });
    expect(rows()[0]?.label).toBe('timer.createOptionInProject');
  });

  it('picking a suggestion binds it, takes its project, and editing the text unbinds it', async () => {
    const { menu, rows, type, sync, task, project, events } = await mountInput([suggestion]);

    await type('fix');
    await settleSuggestions();
    const picked = rows().find((r) => r.id === 'task-7')!;
    picked.onSelect();
    await menu.vm.$emit('update:modelValue', picked.name);
    await sync();

    expect(task.value).toEqual({ id: 'task-7', name: 'fix login' });
    expect(project.value).toEqual({ id: 'p-nord', name: 'Nordwind' });
    expect(events.pickTask).toHaveBeenCalledWith({ id: 'task-7', name: 'fix login' });

    await type('fix login again');
    expect(task.value).toBeNull();
  });

  it('only emits enter when the overlay is closed', async () => {
    const { wrapper, menu, events } = await mountInput();
    const input = wrapper.find('input');

    await menu.vm.$emit('update:open', true);
    await input.trigger('keydown.enter');
    expect(events.enter).not.toHaveBeenCalled();

    await menu.vm.$emit('update:open', false);
    await input.trigger('keydown.enter');
    expect(events.enter).toHaveBeenCalledTimes(1);
  });

  it('keeps @ literal when the project list fails to load', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const wrapper = await mountSuspended(TaskTitleInput, {
      props: { chipTestid: 'chip', text: '' },
      global: { stubs: { UInputMenu: InputMenuStub, UButton: ButtonStub } },
    });
    const menu = wrapper.findComponent(InputMenuStub);
    await menu.vm.$emit('focus');
    await flushPromises();
    await wrapper.find('input').setValue('fix @helios');
    await flushPromises();

    // SAFETY: the stubbed menu receives the items built by buildTaskTitleMenuItems.
    const rows = menu.props('items') as MenuRow[];
    expect(rows.some((r) => r.type === 'label')).toBe(false);
  });

  describe('resolveCommit', () => {
    async function commitFor(
      value: string,
      options: { project?: TitleProject; task?: TitleTask } = {},
    ) {
      const { wrapper } = await mountInput();
      await wrapper.setProps({
        text: value,
        project: options.project ?? null,
        task: options.task ?? null,
      });
      await flushPromises();
      return wrapper.vm.resolveCommit();
    }

    it('uses the chip project for a free-form title', async () => {
      const commit = await commitFor('fix login', { project: { id: 'p-nord', name: 'Nordwind' } });
      expect(commit).toEqual({
        title: 'fix login',
        projectId: 'p-nord',
        taskId: null,
        resolved: null,
      });
    });

    it('resolves a fully typed mention over the chip, but keeps a partial one literal', async () => {
      const full = await commitFor('fix login @helios', {
        project: { id: 'p-nord', name: 'Nordwind' },
      });
      expect(full).toMatchObject({
        title: 'fix login',
        projectId: 'p-helios',
        resolved: { id: 'p-helios', name: 'Helios' },
      });

      const partial = await commitFor('fix login @hel');
      expect(partial).toMatchObject({ title: 'fix login @hel', projectId: undefined });
    });

    it('sends only the task for an unedited bound suggestion', async () => {
      const commit = await commitFor('fix login', {
        task: { id: 'task-7', name: 'fix login' },
        project: { id: 'p-nord', name: 'Nordwind' },
      });
      expect(commit).toMatchObject({ taskId: 'task-7', projectId: undefined });
    });

    it('drops the project for an untitled commit', async () => {
      const commit = await commitFor('', { project: { id: 'p-nord', name: 'Nordwind' } });
      expect(commit).toMatchObject({ title: '', projectId: undefined, taskId: null });
    });
  });
});
