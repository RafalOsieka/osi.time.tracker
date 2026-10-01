<script setup lang="ts">
import type { ModelRef } from 'vue';
import {
  findMentionAtCaret,
  rankMentionProjects,
  removeMention,
  resolveTypedMention,
  type TitleProject,
  type TitleTask,
} from '../utils/title-mention';

/**
 * Time-entry title autocomplete shared by the top-bar timer and the add-entry
 * dialog: task suggestions, the create-new-task row, `@project` mentions
 * (REQ-372–REQ-375) and the project chip (REQ-374). Callers own the commit
 * (start / PATCH / POST) and call `resolveCommit()` to learn what to send.
 *
 * Extra attributes (`id`, `aria-label`, `data-testid`, `class`) go to the
 * underlying `UInputMenu`.
 */
defineOptions({ inheritAttrs: false });

const {
  eager = false,
  placeholder = undefined,
  disabled = false,
  chipTestid,
} = defineProps<{
  /** Load the mention project list on mount instead of on first focus. */
  eager?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Prefix for the chip's test ids: `${chipTestid}-chip` and `${chipTestid}-chip-remove`. */
  chipTestid: string;
}>();

/**
 * A parent-controlled model only updates after the parent re-renders, but UInputMenu fires
 * an item's onSelect, its model update, and a following blur back to back. Mirror the model
 * locally so reads right after a write (and `resolveCommit()`) see the new value.
 */
function useLocalModel<T>(model: ModelRef<T>) {
  const local = shallowRef(model.value);
  watch(model, (value) => {
    local.value = value;
  });
  return computed({
    get: () => local.value,
    set: (value: T) => {
      local.value = value;
      model.value = value;
    },
  });
}

/** The live title text, with a picked mention token already removed. */
const textModel = defineModel<string>('text', { default: '' });
/** Project chip: set by a pick, a typed mention or a picked suggestion. */
const projectModel = defineModel<TitleProject | null>('project', { default: null });
/** Suggestion bound to the text by identity; cleared as soon as the text is edited. */
const taskModel = defineModel<TitleTask | null>('task', { default: null });
const text = useLocalModel(textModel);
const project = useLocalModel(projectModel);
const task = useLocalModel(taskModel);

const emit = defineEmits<{
  /** A project was picked from the mention list; `strippedText` is the new title text. */
  pickProject: [project: TitleProject, strippedText: string];
  removeProject: [];
  /** A task suggestion was committed as the model value. */
  pickTask: [task: TitleTask];
  blur: [];
  /** Enter was pressed while the overlay is closed. */
  enter: [];
}>();

const { t } = useI18n();
const { suggestions, search: searchSuggestions } = useTaskSuggestions();
const { projects: mentionProjects, load: loadMentionProjects } = useMentionProjects();

const overlayOpen = ref(false);
const caret = ref(0);
const menuRef = useTemplateRef('menuRef');

onMounted(() => {
  if (eager) void loadMentionProjects();
});

function syncCaret() {
  caret.value = menuRef.value?.inputRef?.selectionStart ?? text.value.length;
}

watch([text, () => project.value?.id], ([query, projectId]) => {
  syncCaret();
  searchSuggestions(query, projectId);
  // Editing the text after a pick unbinds the suggestion (REQ-180).
  if (task.value && query !== task.value.name) {
    task.value = null;
  }
});

/** Mention token under the caret, when it matches at least one project (REQ-372). */
const mention = computed(() => {
  const token = findMentionAtCaret(text.value, Math.min(caret.value, text.value.length));
  if (!token) return null;
  const projects = rankMentionProjects(mentionProjects.value, token.query);
  if (projects.length === 0) return null;
  return {
    projects,
    textWithoutToken: removeMention(text.value, token.start, token.end),
  };
});

/** A fully typed `@Project name` that would resolve on commit (REQ-375). */
const typedResolution = computed(() => resolveTypedMention(text.value, mentionProjects.value));

function onSelectProject(picked: TitleProject) {
  const stripped = mention.value?.textWithoutToken ?? '';
  project.value = { id: picked.id, name: picked.name };
  task.value = null;
  text.value = stripped;
  emit('pickProject', picked, stripped);
}

/**
 * Menu items use a string `name` as the model value (autocomplete mode
 * stringifies objects to "[object Object]"). `onSelect` captures the
 * concrete task before the model update lands.
 */
const menuItems = computed(() =>
  buildTaskTitleMenuItems({
    suggestions: suggestions.value,
    // The create row previews a typed mention's resolution: title and project.
    searchText: typedResolution.value?.title ?? text.value,
    noProjectLabel: t('timer.noTask'),
    createOptionLabel: (typed) => t('timer.createOption', { title: typed }),
    createProjectName: (typedResolution.value?.project ?? project.value)?.name,
    createOptionLabelWithProject: (typed, projectName) =>
      t('timer.createOptionInProject', { title: typed, project: projectName }),
    mention: mention.value
      ? {
          projects: mention.value.projects,
          textWithoutToken: mention.value.textWithoutToken,
          groupLabel: t('timer.mention.projectsLabel'),
          onSelectProject,
        }
      : undefined,
    onSelectTask: (picked) => {
      task.value = { id: picked.id, name: picked.name };
      project.value =
        picked.projectId && picked.projectName
          ? { id: picked.projectId, name: picked.projectName }
          : null;
      text.value = picked.name;
    },
    onSelectCreate: (typed) => {
      // Clear any previously captured task identity so the commit is freeform.
      task.value = null;
      if (typedResolution.value) {
        project.value = {
          id: typedResolution.value.project.id,
          name: typedResolution.value.project.name,
        };
      }
      text.value = typed;
      overlayOpen.value = false;
    },
  }),
);

function onModelUpdate(value: string | null | undefined) {
  const next = value ?? '';
  // Selection path: the item's onSelect already stashed the task for this name.
  const bound = task.value;
  if (bound && bound.name === next) {
    task.value = bound;
    text.value = next;
    emit('pickTask', bound);
    return;
  }
  task.value = null;
  text.value = next;
}

function onSearchTerm(value: string | null | undefined) {
  text.value = value ?? '';
}

function onEnter() {
  if (overlayOpen.value) return;
  emit('enter');
}

function removeChip() {
  project.value = null;
  emit('removeProject');
}

export interface TitleCommit {
  /** Trimmed title with a resolved typed mention removed; empty for an untitled entry. */
  title: string;
  /** Chip or resolved project; `undefined` for a bound task or an untitled entry. */
  projectId: string | undefined;
  /** Bound suggestion, sent instead of title + project. */
  taskId: string | null;
  /** Project a typed mention resolved to, when it did (REQ-375). */
  resolved: TitleProject | null;
}

/** What to send when committing the current text (REQ-376). */
function resolveCommit(): TitleCommit {
  let title = text.value.trim();
  const bound = task.value && task.value.name === title ? task.value : null;
  if (bound) {
    return { title, projectId: undefined, taskId: bound.id, resolved: null };
  }
  let projectId = project.value?.id;
  let resolved: TitleProject | null = null;
  const typed = resolveTypedMention(title, mentionProjects.value);
  if (typed) {
    title = typed.title;
    projectId = typed.project.id;
    resolved = { id: typed.project.id, name: typed.project.name };
  }
  // A project belongs to a task, so an untitled entry cannot carry one.
  if (!title) projectId = undefined;
  return { title, projectId, taskId: null, resolved };
}

defineExpose({ resolveCommit });
</script>

<template>
  <!--
    With a chip the wrapper draws the input's outline and the inner input drops its own,
    so the chip is ordinary flow content: no widths to guess or measure, nothing shifts.
  -->
  <div
    class="flex min-w-0 flex-1 items-center"
    :class="
      project &&
      'rounded-md bg-default ring ring-inset ring-accented focus-within:ring-2 focus-within:ring-primary'
    "
  >
    <span
      v-if="project"
      class="ms-2.5 flex shrink-0 items-center"
      :data-testid="`${chipTestid}-chip`"
    >
      <UBadge color="neutral" variant="subtle" size="md" class="max-w-40 gap-1 py-0.5 pe-0.5">
        <span class="truncate">{{ project.name }}</span>
        <UButton
          square
          color="neutral"
          variant="link"
          size="xs"
          icon="i-lucide-x"
          class="p-0"
          :aria-label="t('timer.mention.removeProject', { project: project.name })"
          :data-testid="`${chipTestid}-chip-remove`"
          @click="removeChip"
        />
      </UBadge>
    </span>
    <UInputMenu
      v-bind="$attrs"
      ref="menuRef"
      v-model:open="overlayOpen"
      :model-value="text"
      :search-term="text"
      :items="menuItems"
      value-key="name"
      label-key="label"
      :variant="project ? 'none' : 'outline'"
      :disabled="disabled"
      :placeholder="placeholder"
      mode="autocomplete"
      ignore-filter
      class="min-w-0 flex-1"
      @update:model-value="onModelUpdate"
      @update:search-term="onSearchTerm"
      @focus="loadMentionProjects"
      @blur="emit('blur')"
      @keydown.enter="onEnter"
      @keyup="syncCaret"
      @click="syncCaret"
    />
  </div>
</template>
