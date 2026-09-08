<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import { finalizeRemoteExportSchema } from '~~/shared/types/remote-export';

const { disabled } = defineProps<{ disabled: boolean }>();
const emit = defineEmits<{ reconcile: [remoteLogId: string] }>();
const { t } = useI18n();
const schema = finalizeRemoteExportSchema.pick({ remoteLogId: true });
const state = reactive({ remoteLogId: '' });

function submit(event: FormSubmitEvent<typeof state>) {
  if (!disabled) emit('reconcile', event.data.remoteLogId);
}
</script>

<template>
  <UForm
    :schema="schema"
    :state="state"
    class="mt-2 grid gap-2"
    data-testid="remote-sync-existing-log-form"
    @submit="submit"
  >
    <UFormField name="remoteLogId" :label="t('remoteSync.exportDialog.existingLogId')">
      <UInput
        v-model="state.remoteLogId"
        :disabled="disabled"
        data-testid="remote-sync-existing-log-id"
      />
    </UFormField>
    <p class="text-muted">{{ t('remoteSync.exportDialog.existingLogHint') }}</p>
    <UButton
      type="submit"
      size="xs"
      variant="soft"
      :disabled="disabled || !state.remoteLogId.trim()"
      :label="t('remoteSync.exportDialog.useExistingLog')"
      data-testid="remote-sync-existing-log-submit"
    />
  </UForm>
</template>
