import type { TaskDto } from '../../shared/types/task';
import { formatTaskSuggestionLabel } from './task-suggestion-label';

/** Id of the non-selectable "Projects" heading row in project mode. */
export const TASK_TITLE_MENU_LABEL_ID = '__projects_label__';

/** Sentinel id for the synthetic "create new task" row (not a real task). */
export const TASK_TITLE_CREATE_ITEM_ID = '__create_new_task__';

/**
 * Menu item shape for freeform task-title autocomplete.
 * The string model uses `name` as value-key; `onSelect` captures real task identity.
 */
export interface TaskTitleMenuItem {
  /** 'label' marks a non-selectable group heading (UInputMenu structural item). */
  type?: 'label';
  id: string;
  name: string;
  label: string;
  onSelect: () => void;
}

/** A project row offered while the caret is in a `@mention` (REQ-372). */
export interface MentionMenuProject {
  id: string;
  name: string;
  trackerName: string | null;
}

export interface MentionMenuOptions {
  /** Already ranked and capped (`rankMentionProjects`). */
  projects: MentionMenuProject[];
  /** Input text with the mention token removed; becomes every row's model value. */
  textWithoutToken: string;
  groupLabel: string;
  onSelectProject: (project: MentionMenuProject) => void;
}

export interface BuildTaskTitleMenuItemsOptions {
  suggestions: TaskDto[];
  searchText: string;
  noProjectLabel: string;
  /** i18n label for the synthetic create row, given the trimmed typed title. */
  createOptionLabel: (title: string) => string;
  /** Create row label when the commit carries a project: "(new task in {project})". */
  createOptionLabelWithProject?: (title: string, projectName: string) => string;
  /** Project the create row would commit into (chip or resolved typed mention). */
  createProjectName?: string | null;
  onSelectTask: (task: TaskDto) => void;
  /** Called when the user picks the synthetic create row. */
  onSelectCreate: (title: string) => void;
  /** When false, omit the synthetic create row. Default true. */
  includeCreateRow?: boolean;
  /** Project mode: when set, only the labelled project group is returned (REQ-372). */
  mention?: MentionMenuOptions;
}

/**
 * Builds UInputMenu autocomplete items from task suggestions.
 * Keeps a string model (value-key `name`, label-key `label`) and captures
 * task identity in `onSelect` so callers never need `as unknown as`.
 */
export function buildTaskTitleMenuItems(
  options: BuildTaskTitleMenuItemsOptions,
): TaskTitleMenuItem[] {
  const {
    suggestions,
    searchText,
    noProjectLabel,
    createOptionLabel,
    createOptionLabelWithProject,
    createProjectName,
    onSelectTask,
    onSelectCreate,
    includeCreateRow = true,
    mention,
  } = options;

  if (mention) {
    return [
      {
        type: 'label',
        id: TASK_TITLE_MENU_LABEL_ID,
        name: '',
        label: mention.groupLabel,
        onSelect: () => undefined,
      },
      ...mention.projects.map((project): TaskTitleMenuItem => ({
        id: project.id,
        name: mention.textWithoutToken,
        label: project.trackerName ? `${project.name} · ${project.trackerName}` : project.name,
        onSelect: () => {
          mention.onSelectProject(project);
        },
      })),
    ];
  }

  const typed = searchText.trim();
  const items: TaskTitleMenuItem[] = [];

  if (includeCreateRow && typed) {
    items.push({
      id: TASK_TITLE_CREATE_ITEM_ID,
      name: typed,
      label:
        createProjectName && createOptionLabelWithProject
          ? createOptionLabelWithProject(typed, createProjectName)
          : createOptionLabel(typed),
      onSelect: () => {
        onSelectCreate(typed);
      },
    });
  }

  for (const task of suggestions) {
    items.push({
      id: task.id,
      name: task.name,
      label: formatTaskSuggestionLabel(task, noProjectLabel),
      onSelect: () => {
        onSelectTask(task);
      },
    });
  }

  return items;
}
