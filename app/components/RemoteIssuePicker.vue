<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { TrackerDto } from '../../shared/types/tracker';
import {
  REMOTE_ISSUE_SEARCH_MODE_ORDER,
  type RemoteIssueRefDto,
  type RemoteIssueSearchMode,
  type RemoteIssueSearchResult,
} from '../../shared/types/remote-issue-ref';
import { useRemoteIssueSearch } from '~/composables/useRemoteIssueSearch';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  config: TrackerDto;
  currentRef?: RemoteIssueRefDto;
  linkTestid?: string;
  cachedTestid?: string;
  unlinkedTestid?: string;
}>();

const emit = defineEmits<{
  link: [{ remoteIssueId: string; cachedTitle: string }];
  unlink: [];
}>();

const { t } = useI18n();
const { search, results, loading, errorKey } = useRemoteIssueSearch(props.config);

const open = shallowRef(false);
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const state = reactive<{ mode: RemoteIssueSearchMode; query: string }>({
  mode: REMOTE_ISSUE_SEARCH_MODE_ORDER[0],
  query: '',
});
const firstField = useTemplateRef<HTMLElement>('firstField');

const showEditMenu = computed(() => !!props.currentRef && !open.value);
const editMenuClass = computed(() => [
  'pointer-events-none absolute top-full right-0 z-20 pt-1 opacity-0',
  'group-hover/ri:pointer-events-auto group-hover/ri:opacity-100',
  'group-focus-within/ri:pointer-events-auto group-focus-within/ri:opacity-100',
]);

const searchModeLabelKeys = {
  title: 'remoteIssuePicker.modeTitle',
  id: 'remoteIssuePicker.modeId',
} as const satisfies Record<RemoteIssueSearchMode, string>;

const modeItems = computed(() =>
  REMOTE_ISSUE_SEARCH_MODE_ORDER.map((value) => ({
    label: t(searchModeLabelKeys[value]),
    value,
  })),
);

const statusMessage = computed(() => {
  if (loading.value) return t('remoteIssuePicker.loading');
  if (errorKey.value) return t(errorKey.value);
  if (results.value.length === 1) {
    return t('remoteIssuePicker.resultCountOne', { count: 1 });
  }
  if (results.value.length > 1) {
    return t('remoteIssuePicker.resultCount', { count: results.value.length });
  }
  return t('remoteIssuePicker.emptyResults');
});

function onTriggerClick() {
  open.value = true;
}

async function onOpenChange(value: boolean) {
  open.value = value;
  if (!value) return;
  await nextTick();
  firstField.value?.focus?.();
}

function onClose() {
  open.value = false;
}

async function submit() {
  await search({ mode: state.mode, query: state.query });
}

function selectResult(result: RemoteIssueSearchResult) {
  emit('link', { remoteIssueId: result.remoteIssueId, cachedTitle: result.title });
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
    class="group/ri relative inline-flex min-w-6 items-center justify-center"
  >
    <UButton
      v-if="currentRef && currentRef.url"
      :to="currentRef.url"
      target="_blank"
      external
      variant="link"
      size="xs"
      class="min-w-6 justify-center px-0 font-mono text-sm tabular-nums"
      :label="`#${currentRef.remoteIssueId}`"
      :title="`${t('timerView.remoteIssue.linkedTooltipPrefix')} #${currentRef.remoteIssueId}: ${currentRef.cachedTitle}`"
      :data-testid="linkTestid"
    />
    <span
      v-else-if="currentRef"
      :title="`${t('timerView.remoteIssue.linkedTooltipPrefix')} #${currentRef.remoteIssueId}: ${currentRef.cachedTitle}`"
      class="inline-flex min-w-6 justify-center font-mono text-sm tabular-nums text-primary"
      :data-testid="cachedTestid"
    >
      #{{ currentRef.remoteIssueId }}
    </span>

    <div v-if="showEditMenu" :class="editMenuClass" data-testid="remote-issue-picker-edit-menu">
      <div class="rounded-md bg-default p-1 shadow-lg ring ring-default">
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
      </div>
    </div>
    <UButton
      v-else-if="!currentRef"
      icon="i-lucide-link-2-off"
      color="neutral"
      variant="ghost"
      square
      size="xs"
      class="w-6 shrink-0 justify-center"
      :aria-label="t('timerView.remoteIssue.unlinked')"
      :title="t('timerView.remoteIssue.unlinked')"
      :data-testid="unlinkedTestid ?? 'remote-issue-picker-trigger'"
      @click.stop="onTriggerClick"
    />

    <UPopover
      :open="open"
      :modal="false"
      :reference="rootEl ?? undefined"
      :content="{ side: 'bottom', align: 'end', sideOffset: 4 }"
      @update:open="onOpenChange"
    >
      <template #content>
        <div class="grid min-w-64 gap-3 p-3">
          <UForm
            :schema="remoteIssuePickerFormSchema"
            :state="state"
            class="grid gap-3"
            @submit="submit"
          >
            <div class="grid gap-1">
              <label for="remote-issue-mode">{{ t('remoteIssuePicker.modeLabel') }}</label>
              <URadioGroup
                id="remote-issue-mode"
                ref="firstField"
                v-model="state.mode"
                :items="modeItems"
                orientation="horizontal"
                value-key="value"
                label-key="label"
                data-testid="remote-issue-picker-mode"
              />
            </div>
            <div class="grid gap-1">
              <label for="remote-issue-query">{{ t('remoteIssuePicker.queryLabel') }}</label>
              <UInput
                id="remote-issue-query"
                v-model="state.query"
                :placeholder="t('remoteIssuePicker.queryPlaceholder')"
                data-testid="remote-issue-picker-query"
              />
            </div>
            <UButton
              type="submit"
              :label="t('remoteIssuePicker.submitButton')"
              data-testid="remote-issue-picker-submit"
            />
          </UForm>

          <p class="m-0 text-sm text-muted" role="status" aria-live="polite">
            {{ statusMessage }}
          </p>

          <ul
            v-if="results.length > 0"
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
                class="justify-start"
                :label="`#${result.remoteIssueId} ${result.title}`"
                :data-testid="`remote-issue-picker-result-${result.remoteIssueId}`"
                @click="selectResult(result)"
              />
            </li>
          </ul>

          <UButton
            v-if="currentRef"
            type="button"
            color="error"
            variant="ghost"
            :label="t('remoteIssuePicker.unlinkButton')"
            data-testid="remote-issue-picker-unlink"
            @click.stop="unlink"
          />
        </div>
      </template>
    </UPopover>
  </span>
</template>
