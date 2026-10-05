<script setup lang="ts">
import type { ExtensionSuggestionState } from '~/composables/use-extension-suggestion';

/**
 * "Request approval in extension" for one unapproved tracker, with the outcome in place: the
 * extension queues the tracker and the user finishes the approval there (REQ-316, REQ-317).
 */
const { state, testId } = defineProps<{
  state: ExtensionSuggestionState | undefined;
  testId: string;
}>();

const emit = defineEmits<{ request: [] }>();

const { t } = useI18n();
</script>

<template>
  <div class="grid gap-1">
    <p
      v-if="state?.status === 'queued'"
      role="status"
      class="m-0 text-xs text-muted"
      :data-testid="`${testId}-queued`"
    >
      {{ t('layout.extensionStatus.requestSent') }}
    </p>
    <template v-else>
      <UButton
        variant="link"
        size="xs"
        class="justify-start p-0"
        icon="i-lucide-send"
        :loading="state?.status === 'sending'"
        :label="t('layout.extensionStatus.requestApproval')"
        :data-testid="testId"
        @click="emit('request')"
      />
      <p
        v-if="state?.status === 'failed'"
        role="alert"
        class="m-0 text-xs text-error"
        :data-testid="`${testId}-error`"
      >
        {{ t(state.messageKey) }}
      </p>
    </template>
  </div>
</template>
