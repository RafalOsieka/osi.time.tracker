<script setup lang="ts">
import type { TrackerSystemType } from '@osi/remote-trackers/contracts';
import type { TrackerExecutionMode } from '~~/shared/types/tracker';
import { useTrackerExtensionAvailability } from '~/composables/use-tracker-extension-availability';

const {
  executionMode,
  systemType,
  baseUrl,
  compact = false,
} = defineProps<{
  executionMode: TrackerExecutionMode;
  systemType: TrackerSystemType;
  baseUrl: string;
  compact?: boolean;
}>();

const { t } = useI18n();
const { status, messageKey, checking, visible, recheck } = useTrackerExtensionAvailability(() => ({
  executionMode,
  systemType,
  baseUrl,
}));

const statusText = computed(() => {
  if (status.value === 'checking' || status.value === 'idle') {
    return t('trackers.extensionStatusChecking');
  }
  if (status.value === 'available') {
    return t('trackers.extensionStatusAvailable');
  }
  return t(messageKey.value);
});
</script>

<template>
  <div v-if="visible" class="grid gap-2" data-testid="tracker-extension-status">
    <p
      class="text-sm text-muted"
      data-testid="tracker-extension-status-text"
      role="status"
      aria-live="polite"
    >
      {{ statusText }}
    </p>
    <p v-if="!compact" class="text-sm" data-testid="tracker-extension-setup-guidance">
      {{ t('trackers.extensionSetupGuidance') }}
    </p>
    <UButton
      type="button"
      color="neutral"
      variant="outline"
      size="sm"
      :loading="checking"
      data-testid="tracker-extension-recheck"
      :aria-label="t('trackers.extensionRecheckButton')"
      @click="recheck"
    >
      {{ t('trackers.extensionRecheckButton') }}
    </UButton>
  </div>
</template>
