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

const props = defineProps<{
  config: TrackerDto;
  currentRef?: RemoteIssueRefDto;
}>();

const emit = defineEmits<{
  link: [{ remoteIssueId: string; cachedTitle: string }];
  unlink: [];
}>();

const { t } = useI18n();
const { search, results, loading, errorKey } = useRemoteIssueSearch(props.config);

const open = ref(false);
const state = reactive<{ mode: RemoteIssueSearchMode; query: string }>({
  mode: REMOTE_ISSUE_SEARCH_MODE_ORDER[0],
  query: '',
});
const firstField = ref<HTMLElement | null>(null);
let triggerElement: HTMLElement | null = null;

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

async function onOpen(event: Event) {
  const target = event.currentTarget;
  triggerElement = target instanceof HTMLElement ? target : null;
  open.value = true;
  await nextTick();
  firstField.value?.focus?.();
}

function onClose() {
  open.value = false;
  triggerElement?.focus();
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
</script>

<template>
  <span class="inline-flex">
    <UPopover v-model:open="open">
      <UButton
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        square
        :aria-label="t('timerView.remoteIssue.editLabel')"
        data-testid="remote-issue-picker-trigger"
        @click="onOpen"
      />
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
            color="error"
            variant="ghost"
            :label="t('remoteIssuePicker.unlinkButton')"
            data-testid="remote-issue-picker-unlink"
            @click="unlink"
          />
        </div>
      </template>
    </UPopover>
  </span>
</template>
