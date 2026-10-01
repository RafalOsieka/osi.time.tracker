import { describe, expect, it, vi } from 'vitest';
import {
  buildTaskTitleMenuItems,
  TASK_TITLE_CREATE_ITEM_ID,
} from '../../app/utils/task-title-menu';
import type { TaskDto } from '../../shared/types/task';

function task(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: 'task-1',
    name: 'Fix login',
    projectId: 'project-1',
    projectName: 'Portal',
    createdAt: '',
    ...overrides,
  };
}

describe('buildTaskTitleMenuItems', () => {
  it('maps suggestion rows with labels and onSelect capturing the task', () => {
    const onSelectTask = vi.fn();
    const onSelectCreate = vi.fn();
    const items = buildTaskTitleMenuItems({
      suggestions: [task()],
      searchText: '',
      noProjectLabel: '(no project)',
      createOptionLabel: (title) => `Create "${title}"`,
      onSelectTask,
      onSelectCreate,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'task-1',
      name: 'Fix login',
      label: 'Fix login · Portal',
    });
    items[0]?.onSelect();
    expect(onSelectTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1', name: 'Fix login' }),
    );
    expect(onSelectCreate).not.toHaveBeenCalled();
  });

  it('prepends a synthetic create row for non-empty typed text', () => {
    const onSelectTask = vi.fn();
    const onSelectCreate = vi.fn();
    const items = buildTaskTitleMenuItems({
      suggestions: [task()],
      searchText: '  New task  ',
      noProjectLabel: '(no project)',
      createOptionLabel: (title) => `Create "${title}"`,
      onSelectTask,
      onSelectCreate,
    });

    expect(items).toHaveLength(2);
    const create = items[0];
    expect(create).toMatchObject({
      id: TASK_TITLE_CREATE_ITEM_ID,
      name: 'New task',
      label: 'Create "New task"',
    });
    expect(items[1]?.id).toBe('task-1');
    create?.onSelect();
    expect(onSelectCreate).toHaveBeenCalledWith('New task');
    expect(onSelectTask).not.toHaveBeenCalled();
  });

  it('omits the create row when includeCreateRow is false', () => {
    const items = buildTaskTitleMenuItems({
      suggestions: [task()],
      searchText: 'typed',
      noProjectLabel: '(no project)',
      createOptionLabel: (title) => title,
      onSelectTask: () => undefined,
      onSelectCreate: () => undefined,
      includeCreateRow: false,
    });
    expect(items).toHaveLength(1);
    expect(items.every((item) => item.id !== TASK_TITLE_CREATE_ITEM_ID)).toBe(true);
  });

  it('does not add a create row for blank search text', () => {
    const items = buildTaskTitleMenuItems({
      suggestions: [],
      searchText: '   ',
      noProjectLabel: '(no project)',
      createOptionLabel: (title) => title,
      onSelectTask: () => undefined,
      onSelectCreate: () => undefined,
    });
    expect(items).toEqual([]);
  });
});

describe('buildTaskTitleMenuItems project mode', () => {
  const base = {
    suggestions: [task()],
    noProjectLabel: '(no project)',
    createOptionLabel: (title: string) => `Create "${title}"`,
    onSelectTask: () => undefined,
    onSelectCreate: () => undefined,
  };

  it('returns only a labelled project group whose rows carry the stripped text', () => {
    const onSelectProject = vi.fn();
    const items = buildTaskTitleMenuItems({
      ...base,
      searchText: 'fix login @hel',
      mention: {
        projects: [
          { id: 'p1', name: 'Helios', trackerName: 'Acme' },
          { id: 'p2', name: 'Helix', trackerName: null },
        ],
        textWithoutToken: 'fix login',
        groupLabel: 'Projects',
        onSelectProject,
      },
    });

    expect(items[0]).toMatchObject({ type: 'label', label: 'Projects' });
    expect(items.slice(1)).toMatchObject([
      { id: 'p1', name: 'fix login', label: 'Helios · Acme' },
      { id: 'p2', name: 'fix login', label: 'Helix' },
    ]);
    items[2]?.onSelect();
    expect(onSelectProject).toHaveBeenCalledWith({ id: 'p2', name: 'Helix', trackerName: null });
  });

  it('names the project in the create row label when the commit carries one', () => {
    const items = buildTaskTitleMenuItems({
      ...base,
      searchText: 'fix login',
      createProjectName: 'Helios',
      createOptionLabelWithProject: (title, project) => `${title} (new task in ${project})`,
    });
    expect(items[0]?.label).toBe('fix login (new task in Helios)');
  });
});
