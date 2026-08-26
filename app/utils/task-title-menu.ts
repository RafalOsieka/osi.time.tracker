import type { TaskDto } from '../../shared/types/task';
import { formatTaskSuggestionLabel } from './task-suggestion-label';

/** Sentinel id for the synthetic "create new task" row (not a real task). */
export const TASK_TITLE_CREATE_ITEM_ID = '__create_new_task__';

/**
 * Menu item shape for freeform task-title autocomplete.
 * The string model uses `name` as value-key; `onSelect` captures real task identity.
 */
export interface TaskTitleMenuItem {
  id: string;
  name: string;
  label: string;
  onSelect: () => void;
}

export interface BuildTaskTitleMenuItemsOptions {
  suggestions: TaskDto[];
  searchText: string;
  noProjectLabel: string;
  /** i18n label for the synthetic create row, given the trimmed typed title. */
  createOptionLabel: (title: string) => string;
  onSelectTask: (task: TaskDto) => void;
  /** Called when the user picks the synthetic create row. */
  onSelectCreate: (title: string) => void;
  /** When false, omit the synthetic create row. Default true. */
  includeCreateRow?: boolean;
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
    onSelectTask,
    onSelectCreate,
    includeCreateRow = true,
  } = options;

  const typed = searchText.trim();
  const items: TaskTitleMenuItem[] = [];

  if (includeCreateRow && typed) {
    items.push({
      id: TASK_TITLE_CREATE_ITEM_ID,
      name: typed,
      label: createOptionLabel(typed),
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
