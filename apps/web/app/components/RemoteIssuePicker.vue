<script setup lang="ts">
import {
  REMOTE_ISSUE_SEARCH_MODE_ORDER,
  type RemoteIssueScope,
  type RemoteIssueSearchMode,
  type RemoteIssueSearchResult,
} from '@osi/time-tracker-remote-trackers/contracts';
import type { RemoteIssueRefDto } from '../../shared/types/remote-issue-ref';
import type { TrackerDto } from '../../shared/types/tracker';

defineOptions({ inheritAttrs: false });

const {
  config,
  currentRef = undefined,
  scope = null,
  linkTestid = undefined,
  cachedTestid = undefined,
  unlinkedTestid = undefined,
  linkLabel = undefined,
  contextLabel = undefined,
} = defineProps<{
  config: TrackerDto;
  currentRef?: RemoteIssueRefDto;
  /** The owning project's remote project scope (REQ-328), if any. */
  scope?: (RemoteIssueScope & { remoteProjectTitle: string }) | null;
  linkTestid?: string;
  cachedTestid?: string;
  unlinkedTestid?: string;
  /** Shows the unlinked trigger as a labelled button (Remote Sync) instead of an icon. */
  linkLabel?: string;
  /** What is being linked (the Task title), shown under the popover's heading. */
  contextLabel?: string;
}>();

const emit = defineEmits<{
  link: [
    {
      remoteIssueId: string;
      cachedTitle: string;
      cachedRemoteProjectTitle?: string;
    },
  ];
  unlink: [];
}>();

const { t } = useI18n();
const { search, results, outOfScopeId, loading, errorKey } = useRemoteIssueSearch(
  config,
  () => scope ?? undefined,
);

const headingId = useId();
const open = shallowRef(false);
const hasSearched = shallowRef(false);
// On by default whenever a scope exists (REQ-328); reset on every popover open.
const applyScope = shallowRef(true);
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const state = reactive<{ mode: RemoteIssueSearchMode; query: string }>({
  mode: REMOTE_ISSUE_SEARCH_MODE_ORDER[0],
  query: '',
});

const showEditMenu = computed(() => !!currentRef && !open.value);
const editMenuClass = computed(() => [
  'pointer-events-none absolute top-full right-0 z-20 pt-1 opacity-0',
  'group-hover/ri:pointer-events-auto group-hover/ri:opacity-100',
  'group-focus-within/ri:pointer-events-auto group-focus-within/ri:opacity-100',
]);

/**
 * The radio group drawn as a compact segmented control: joined cells, the checked one cyan. Each
 * radio is stretched, transparent, over its whole cell, so the cell is the radio itself.
 */
const MODE_UI = {
  fieldset: 'w-fit',
  item: 'relative cursor-pointer px-3 py-1 text-muted first-of-type:rounded-s-md last-of-type:rounded-e-md has-data-[state=checked]:text-primary',
  base: 'not-sr-only absolute inset-0 z-[3] size-auto cursor-pointer rounded-none opacity-0 ring-0',
  label: 'text-xs font-medium text-current',
};

const searchModeLabelKeys = {
  title: 'remoteIssuePicker.modeTitle',
  id: 'remoteIssuePicker.modeId',
} as const satisfies Record<RemoteIssueSearchMode, string>;

const queryPlaceholderKey = computed(() =>
  state.mode === 'id'
    ? 'remoteIssuePicker.queryPlaceholderId'
    : 'remoteIssuePicker.queryPlaceholderTitle',
);

const modeItems = computed(() =>
  REMOTE_ISSUE_SEARCH_MODE_ORDER.map((value) => ({
    label: t(searchModeLabelKeys[value]),
    value,
  })),
);

const statusMessage = computed(() => {
  if (loading.value) return t('remoteIssuePicker.loading');
  if (!hasSearched.value) return '';
  if (errorKey.value) return t(errorKey.value);
  if (results.value.length === 0) {
    return t('remoteIssuePicker.emptyResults');
  }
  const count = t(
    'remoteIssuePicker.resultCount',
    { count: results.value.length },
    results.value.length,
  );
  return outOfScopeId.value ? `${count} ${t('remoteIssuePicker.outOfScopeHint')}` : count;
});

const scopeToggleLabel = computed(() =>
  scope ? t('remoteIssuePicker.scopeToggleLabel', { title: scope.remoteProjectTitle }) : '',
);

function linkedTooltip(ref: RemoteIssueRefDto): string {
  const base = `${t('timerView.remoteIssue.linkedTooltipPrefix')} #${ref.remoteIssueId}: ${ref.cachedTitle}`;
  return ref.cachedRemoteProjectTitle ? `${base} · ${ref.cachedRemoteProjectTitle}` : base;
}

function resultAccessibleName(result: RemoteIssueSearchResult): string {
  const base = result.remoteProjectTitle
    ? `#${result.remoteIssueId} ${result.title} ${result.remoteProjectTitle}`
    : `#${result.remoteIssueId} ${result.title}`;
  return result.remoteIssueId === outOfScopeId.value
    ? `${base} ${t('remoteIssuePicker.outOfScopeHint')}`
    : base;
}

function focusQueryInput() {
  rootEl.value?.querySelector('input')?.focus();
}

// Shared by every path that opens the popover (the unlinked icon, the Edit
// menu item, and the popover's own controlled reopen) so state — including
// the scope toggle (REQ-328) — resets the same way regardless of entry point.
async function resetForOpen() {
  state.mode = REMOTE_ISSUE_SEARCH_MODE_ORDER[0];
  applyScope.value = true;
  hasSearched.value = false;
  await nextTick();
  focusQueryInput();
}

async function onTriggerClick() {
  open.value = true;
  await resetForOpen();
}

async function onOpenChange(value: boolean) {
  open.value = value;
  if (!value) {
    hasSearched.value = false;
    return;
  }
  await resetForOpen();
}

function onClose() {
  open.value = false;
  hasSearched.value = false;
}

async function submit() {
  hasSearched.value = true;
  await search({ mode: state.mode, query: state.query }, applyScope.value);
}

function selectResult(result: RemoteIssueSearchResult) {
  emit('link', {
    remoteIssueId: result.remoteIssueId,
    cachedTitle: result.title,
    cachedRemoteProjectTitle: result.remoteProjectTitle,
  });
  onClose();
}

function unlink() {
  emit('unlink');
  onClose();
}

onBeforeUnmount(() => {
  open.value = false;
});
</script>

<template>
  <span
    ref="rootEl"
    v-bind="$attrs"
    class="group/ri relative inline-flex h-6 min-w-6 items-center justify-start"
  >
    <UTooltip
      v-if="currentRef && currentRef.url"
      :text="linkedTooltip(currentRef)"
      :content="{ side: 'top' }"
    >
      <UButton
        :to="currentRef.url"
        target="_blank"
        external
        variant="link"
        color="neutral"
        size="xs"
        class="h-6 min-h-6 min-w-6 justify-start px-0 font-mono text-[0.8125rem] leading-none tabular-nums text-default hover:text-primary hover:underline focus-visible:text-primary"
        :label="`#${currentRef.remoteIssueId}`"
        :aria-label="linkedTooltip(currentRef)"
        :data-testid="linkTestid"
      />
    </UTooltip>
    <UTooltip v-else-if="currentRef" :text="linkedTooltip(currentRef)" :content="{ side: 'top' }">
      <span
        tabindex="0"
        class="inline-flex h-6 min-h-6 min-w-6 items-center justify-start font-mono text-[0.8125rem] leading-none tabular-nums text-default"
        :data-testid="cachedTestid"
      >
        #{{ currentRef.remoteIssueId }}
      </span>
    </UTooltip>

    <div v-if="showEditMenu" :class="editMenuClass" data-testid="remote-issue-picker-edit-menu">
      <div class="grid gap-0.5 rounded-md bg-default p-1 shadow-lg ring ring-default">
        <UButton
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          class="w-full justify-start"
          :label="t('timerView.editLabel')"
          :aria-label="t('timerView.remoteIssue.editLabel')"
          data-testid="remote-issue-picker-trigger"
          @click.stop="onTriggerClick"
        />
        <UButton
          icon="i-lucide-unlink"
          color="error"
          variant="ghost"
          class="w-full justify-start"
          :label="t('remoteIssuePicker.unlinkButton')"
          :aria-label="t('remoteIssuePicker.unlinkButton')"
          data-testid="remote-issue-picker-unlink"
          @click.stop="unlink"
        />
      </div>
    </div>
    <UButton
      v-else-if="!currentRef && linkLabel"
      icon="i-lucide-link"
      color="neutral"
      variant="ghost"
      size="xs"
      class="-ms-2 text-sm font-normal text-muted"
      :label="linkLabel"
      :data-testid="unlinkedTestid ?? 'remote-issue-picker-trigger'"
      @click.stop="onTriggerClick"
    />
    <UTooltip
      v-else-if="!currentRef"
      :text="t('timerView.remoteIssue.unlinked')"
      :content="{ side: 'top' }"
    >
      <UButton
        icon="i-lucide-link"
        color="neutral"
        variant="ghost"
        square
        size="xs"
        class="-ms-1 h-6 w-6 shrink-0 justify-center text-toned hover:bg-primary/10 hover:text-primary focus-visible:text-primary"
        :aria-label="t('timerView.remoteIssue.unlinked')"
        :data-testid="unlinkedTestid ?? 'remote-issue-picker-trigger'"
        @click.stop="onTriggerClick"
      />
    </UTooltip>

    <UPopover
      :open="open"
      :modal="false"
      :reference="rootEl ?? undefined"
      :content="{ side: 'bottom', align: 'end', sideOffset: 4 }"
      @update:open="onOpenChange"
    >
      <template #content>
        <div
          role="group"
          :aria-labelledby="headingId"
          class="grid w-88 max-w-[calc(100vw-2rem)] gap-3 p-3"
        >
          <!-- A heading naming what gets linked: the Task title, when the caller knows it. -->
          <div class="grid min-w-0 gap-0.5">
            <h3 :id="headingId" class="m-0 text-sm font-semibold text-highlighted">
              {{ t('remoteIssuePicker.heading') }}
            </h3>
            <p
              v-if="contextLabel"
              class="m-0 truncate text-xs text-muted"
              data-testid="remote-issue-picker-context"
            >
              {{ contextLabel }}
            </p>
          </div>

          <UForm
            :schema="remoteIssuePickerFormSchema"
            :state="state"
            class="grid gap-2"
            @submit="submit"
          >
            <!--
              The query comes first so it takes the popover's initial focus (REQ-460). The search
              submit is the input's own trailing button; Enter submits too.
            -->
            <UInput
              id="remote-issue-query"
              v-model="state.query"
              class="w-full"
              :ui="{ trailing: 'pe-1' }"
              :aria-label="t('remoteIssuePicker.queryLabel')"
              :placeholder="t(queryPlaceholderKey)"
              data-testid="remote-issue-picker-query"
            >
              <template #trailing>
                <UTooltip :text="t('remoteIssuePicker.submitButton')" :content="{ side: 'top' }">
                  <UButton
                    type="submit"
                    icon="i-lucide-search"
                    color="primary"
                    variant="soft"
                    size="xs"
                    square
                    :loading="loading"
                    :aria-label="t('remoteIssuePicker.submitButton')"
                    data-testid="remote-issue-picker-submit"
                  />
                </UTooltip>
              </template>
            </UInput>
            <!-- The search mode as a compact segmented control (still a radio group), the search
              status beside it. -->
            <div class="flex min-w-0 items-center gap-3">
              <URadioGroup
                id="remote-issue-mode"
                v-model="state.mode"
                :items="modeItems"
                :aria-label="t('remoteIssuePicker.modeLabel')"
                orientation="horizontal"
                variant="table"
                indicator="hidden"
                size="xs"
                value-key="value"
                label-key="label"
                :ui="MODE_UI"
                class="shrink-0"
                data-testid="remote-issue-picker-mode"
              />
              <p
                class="m-0 ms-auto min-w-0 text-end text-xs text-muted"
                role="status"
                aria-live="polite"
              >
                {{ statusMessage }}
              </p>
            </div>
          </UForm>

          <UCheckbox
            v-if="scope"
            id="remote-issue-picker-scope-toggle"
            v-model="applyScope"
            size="sm"
            :label="scopeToggleLabel"
            data-testid="remote-issue-picker-scope-toggle"
          />

          <!-- Full-width option rows, aligned with the input: its edges and its text inset. -->
          <ul
            v-if="hasSearched && results.length > 0"
            class="m-0 -mt-1 grid max-h-60 list-none gap-0.5 overflow-auto p-0"
            :aria-label="t('remoteIssuePicker.resultsLabel')"
            data-testid="remote-issue-picker-results"
          >
            <li v-for="result in results" :key="result.remoteIssueId">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                block
                class="h-auto justify-start rounded-md px-2.5 py-2 text-left hover:bg-elevated focus-visible:bg-elevated dark:hover:bg-accented/60 dark:focus-visible:bg-accented/60"
                :aria-label="resultAccessibleName(result)"
                :data-testid="`remote-issue-picker-result-${result.remoteIssueId}`"
                @click="selectResult(result)"
              >
                <span class="flex min-w-0 flex-col items-start gap-0.5">
                  <span class="w-full truncate text-sm font-medium text-default">
                    {{ result.title }}
                  </span>
                  <span class="flex w-full min-w-0 items-baseline gap-1.5 text-xs text-muted">
                    <span class="shrink-0 font-mono tabular-nums">#{{ result.remoteIssueId }}</span>
                    <template v-if="result.remoteProjectTitle">
                      <span
                        class="size-[3px] shrink-0 self-center rounded-full bg-current"
                        aria-hidden="true"
                      />
                      <span class="truncate">{{ result.remoteProjectTitle }}</span>
                    </template>
                  </span>
                  <span
                    v-if="result.remoteIssueId === outOfScopeId"
                    class="truncate text-xs text-warning"
                    data-testid="remote-issue-picker-out-of-scope-hint"
                  >
                    {{ t('remoteIssuePicker.outOfScopeHint') }}
                  </span>
                </span>
              </UButton>
            </li>
          </ul>
        </div>
      </template>
    </UPopover>
  </span>
</template>
