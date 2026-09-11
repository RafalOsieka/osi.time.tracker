<script setup lang="ts">
import {
  REMOTE_ISSUE_SEARCH_MODE_ORDER,
  type RemoteIssueScope,
  type RemoteIssueSearchMode,
  type RemoteIssueSearchResult,
} from '@osi/remote-trackers/contracts';
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
} = defineProps<{
  config: TrackerDto;
  currentRef?: RemoteIssueRefDto;
  /** The owning project's remote project scope (REQ-328), if any. */
  scope?: (RemoteIssueScope & { remoteProjectTitle: string }) | null;
  linkTestid?: string;
  cachedTestid?: string;
  unlinkedTestid?: string;
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

function resultMeta(result: RemoteIssueSearchResult): string {
  return result.remoteProjectTitle
    ? `#${result.remoteIssueId} · ${result.remoteProjectTitle}`
    : `#${result.remoteIssueId}`;
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
    class="group/ri relative inline-flex h-6 min-w-6 items-center justify-center"
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
        size="xs"
        class="h-6 min-h-6 min-w-6 justify-center px-0 font-mono text-xs leading-none tabular-nums"
        :label="`#${currentRef.remoteIssueId}`"
        :aria-label="linkedTooltip(currentRef)"
        :data-testid="linkTestid"
      />
    </UTooltip>
    <UTooltip v-else-if="currentRef" :text="linkedTooltip(currentRef)" :content="{ side: 'top' }">
      <span
        tabindex="0"
        class="inline-flex h-6 min-h-6 min-w-6 items-center justify-center font-mono text-xs leading-none tabular-nums text-primary"
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
    <UTooltip
      v-else-if="!currentRef"
      :text="t('timerView.remoteIssue.unlinked')"
      :content="{ side: 'top' }"
    >
      <UButton
        icon="i-lucide-link-2-off"
        color="neutral"
        variant="ghost"
        square
        size="xs"
        class="h-6 w-6 shrink-0 justify-center"
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
        <div class="grid w-80 max-w-[min(20rem,calc(100vw-2rem))] gap-2 p-3">
          <UForm
            :schema="remoteIssuePickerFormSchema"
            :state="state"
            class="grid gap-2"
            @submit="submit"
          >
            <div class="flex items-center gap-1">
              <UInput
                id="remote-issue-query"
                v-model="state.query"
                class="min-w-0 flex-1"
                :aria-label="t('remoteIssuePicker.queryLabel')"
                :placeholder="t(queryPlaceholderKey)"
                data-testid="remote-issue-picker-query"
              />
              <UTooltip :text="t('remoteIssuePicker.submitButton')" :content="{ side: 'top' }">
                <UButton
                  type="submit"
                  icon="i-lucide-search"
                  color="neutral"
                  variant="ghost"
                  square
                  :loading="loading"
                  :aria-label="t('remoteIssuePicker.submitButton')"
                  data-testid="remote-issue-picker-submit"
                />
              </UTooltip>
            </div>
            <URadioGroup
              id="remote-issue-mode"
              v-model="state.mode"
              :items="modeItems"
              :aria-label="t('remoteIssuePicker.modeLabel')"
              orientation="horizontal"
              value-key="value"
              label-key="label"
              data-testid="remote-issue-picker-mode"
            />
          </UForm>

          <UCheckbox
            v-if="scope"
            id="remote-issue-picker-scope-toggle"
            v-model="applyScope"
            :label="scopeToggleLabel"
            data-testid="remote-issue-picker-scope-toggle"
          />

          <p v-if="statusMessage" class="m-0 text-sm text-muted" role="status" aria-live="polite">
            {{ statusMessage }}
          </p>

          <ul
            v-if="hasSearched && results.length > 0"
            class="m-0 max-h-48 list-none overflow-auto p-0"
            :aria-label="t('remoteIssuePicker.resultsLabel')"
            data-testid="remote-issue-picker-results"
          >
            <li v-for="result in results" :key="result.remoteIssueId">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                block
                class="h-auto justify-start py-1.5 text-left"
                :aria-label="resultAccessibleName(result)"
                :data-testid="`remote-issue-picker-result-${result.remoteIssueId}`"
                @click="selectResult(result)"
              >
                <span class="flex min-w-0 flex-col items-start gap-0.5">
                  <span class="truncate">{{ result.title }}</span>
                  <span class="truncate text-xs text-muted">{{ resultMeta(result) }}</span>
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
