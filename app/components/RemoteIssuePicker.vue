<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { RemoteSystemConfigDto } from '../../shared/types/remote-system-config';
import type {
  RemoteIssueRefDto,
  RemoteIssueSearchMode,
  RemoteIssueSearchResult,
} from '../../shared/types/remote-issue-ref';
import { useRemoteIssueSearch } from '~/composables/useRemoteIssueSearch';

const props = defineProps<{
  config: RemoteSystemConfigDto;
  currentRef?: RemoteIssueRefDto;
}>();

const emit = defineEmits<{
  link: [{ remoteIssueId: string; cachedTitle: string }];
  unlink: [];
}>();

const { t } = useI18n();
const { search, results, loading, errorKey } = useRemoteIssueSearch(props.config);

const open = ref(false);
const mode = ref<RemoteIssueSearchMode>('title');
const query = ref('');
const firstField = ref<HTMLElement | null>(null);
let triggerElement: HTMLElement | null = null;

const modeItems = computed(() => [
  { label: t('remoteIssuePicker.modeTitle'), value: 'title' as RemoteIssueSearchMode },
  { label: t('remoteIssuePicker.modeId'), value: 'id' as RemoteIssueSearchMode },
]);

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
  triggerElement = event.currentTarget as HTMLElement;
  open.value = true;
  await nextTick();
  firstField.value?.focus?.();
}

function onClose() {
  open.value = false;
  triggerElement?.focus();
}

async function submit() {
  await search({ mode: mode.value, query: query.value });
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
          <form class="grid gap-3" @submit.prevent="submit">
            <div class="grid gap-1">
              <label for="remote-issue-mode">{{ t('remoteIssuePicker.modeLabel') }}</label>
              <URadioGroup
                id="remote-issue-mode"
                ref="firstField"
                v-model="mode"
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
                v-model="query"
                :placeholder="t('remoteIssuePicker.queryPlaceholder')"
                data-testid="remote-issue-picker-query"
              />
            </div>
            <UButton
              type="submit"
              :label="t('remoteIssuePicker.submitButton')"
              data-testid="remote-issue-picker-submit"
            />
          </form>

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
              <button
                type="button"
                class="w-full rounded px-2 py-1 text-left hover:bg-elevated"
                :data-testid="`remote-issue-picker-result-${result.remoteIssueId}`"
                @click="selectResult(result)"
              >
                #{{ result.remoteIssueId }} {{ result.title }}
              </button>
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
