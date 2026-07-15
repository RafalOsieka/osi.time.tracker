<script setup lang="ts">
import { Form } from '@primevue/forms';
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

const popover = ref<{ toggle: (event: Event) => void; hide: () => void }>();
const mode = ref<RemoteIssueSearchMode>('title');
const query = ref('');
const firstField = ref<{ $el?: HTMLElement } | HTMLElement>();
let triggerElement: HTMLElement | null = null;

const modeOptions = computed(() => [
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

async function open(event: Event) {
  triggerElement = event.currentTarget as HTMLElement;
  popover.value?.toggle(event);
  await nextTick();
  const el = firstField.value as { $el?: HTMLElement } | undefined;
  const rootEl = el && '$el' in el ? el.$el : (el as unknown as HTMLElement | undefined);
  const focusable = rootEl?.querySelector?.<HTMLElement>('button, input, [tabindex]');
  (focusable ?? rootEl)?.focus?.();
}

function onHide() {
  triggerElement?.focus();
}

async function submit() {
  await search({ mode: mode.value, query: query.value });
}

function selectResult(result: RemoteIssueSearchResult) {
  emit('link', { remoteIssueId: result.remoteIssueId, cachedTitle: result.title });
  popover.value?.hide();
}

function onResultSelect(remoteIssueId: string | null) {
  if (!remoteIssueId) return;
  const result = results.value.find((r) => r.remoteIssueId === remoteIssueId);
  if (result) selectResult(result);
}

function unlink() {
  emit('unlink');
  popover.value?.hide();
}
</script>

<template>
  <span class="remote-issue-picker">
    <Button
      icon="pi pi-pencil"
      text
      rounded
      :aria-label="t('timerView.remoteIssue.editLabel')"
      data-testid="remote-issue-picker-trigger"
      @click="open"
    />
    <Popover ref="popover" @hide="onHide">
      <Form class="remote-issue-picker__form" @submit="submit">
        <FormFieldWrap
          :label="t('remoteIssuePicker.modeLabel')"
          name="mode"
          input-id="remote-issue-mode"
          error-testid="remote-issue-picker-mode-error"
        >
          <SelectButton
            id="remote-issue-mode"
            ref="firstField"
            v-model="mode"
            :allow-empty="false"
            :options="modeOptions"
            option-label="label"
            option-value="value"
            data-testid="remote-issue-picker-mode"
          />
        </FormFieldWrap>
        <FormFieldWrap
          :label="t('remoteIssuePicker.queryLabel')"
          name="query"
          input-id="remote-issue-query"
          error-testid="remote-issue-picker-query-error"
        >
          <InputText
            id="remote-issue-query"
            v-model="query"
            :placeholder="t('remoteIssuePicker.queryPlaceholder')"
            data-testid="remote-issue-picker-query"
          />
        </FormFieldWrap>
        <Button
          type="submit"
          :label="t('remoteIssuePicker.submitButton')"
          data-testid="remote-issue-picker-submit"
        />
      </Form>

      <p class="remote-issue-picker__status" role="status" aria-live="polite">
        {{ statusMessage }}
      </p>

      <Listbox
        v-if="results.length > 0"
        class="remote-issue-picker__results"
        :options="results"
        option-label="title"
        option-value="remoteIssueId"
        :aria-label="t('remoteIssuePicker.resultsLabel')"
        list-style="max-height: 12rem"
        data-testid="remote-issue-picker-results"
        @update:model-value="onResultSelect"
      >
        <template #option="{ option }">
          <span :data-testid="`remote-issue-picker-result-${option.remoteIssueId}`">
            #{{ option.remoteIssueId }} {{ option.title }}
          </span>
        </template>
      </Listbox>

      <Button
        v-if="currentRef"
        text
        severity="danger"
        :label="t('remoteIssuePicker.unlinkButton')"
        data-testid="remote-issue-picker-unlink"
        @click="unlink"
      />
    </Popover>
  </span>
</template>

<style scoped>
.remote-issue-picker__form {
  display: grid;
  gap: 0.75rem;
  min-width: 16rem;
}

.remote-issue-picker__status {
  margin: 0.5rem 0;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.remote-issue-picker__results {
  margin: 0 0 0.5rem;
}
</style>
