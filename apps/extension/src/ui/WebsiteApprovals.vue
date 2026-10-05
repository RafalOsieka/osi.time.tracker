<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import UForm from '@nuxt/ui/components/Form.vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import ULink from '@nuxt/ui/components/Link.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import UTooltip from '@nuxt/ui/components/Tooltip.vue';
import type { DestinationApproval, WebsiteApproval } from '../approvals/approvals.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import { openWebsite } from './open-website.js';

const { websites, destinations, origin, disabled, errorKey, missingOrigins } = defineProps<{
  websites: readonly WebsiteApproval[];
  destinations: readonly DestinationApproval[];
  origin: string;
  disabled: boolean;
  errorKey: string | null;
  missingOrigins: readonly string[];
}>();

const emit = defineEmits<{
  'update:origin': [value: string];
  add: [];
  revoke: [origin: string];
  restore: [origin: string];
}>();

const { t } = useExtensionI18n();
const empty = computed(() => websites.length === 0);
const formState = computed(() => ({ origin }));

/**
 * Website whose revoke waits for confirmation because trackers would be revoked with it. It
 * outlives `confirmOpen` so the dialog keeps its text while the close animation runs.
 */
const pendingRevoke = shallowRef<string | null>(null);
const pendingTrackerCount = computed(() => trackerCount(pendingRevoke.value));
const confirmOpen = shallowRef(false);

function trackerCount(website: string | null): number {
  return destinations.filter((item) => item.websiteOrigin === website).length;
}

function requestRevoke(website: string): void {
  if (trackerCount(website) === 0) {
    emit('revoke', website);
    return;
  }
  pendingRevoke.value = website;
  confirmOpen.value = true;
}

function confirmRevoke(): void {
  confirmOpen.value = false;
  if (pendingRevoke.value) emit('revoke', pendingRevoke.value);
}
</script>

<template>
  <UCard as="section" aria-labelledby="websites-title" :ui="{ body: 'flex flex-col gap-4' }">
    <template #header>
      <h2 id="websites-title" class="text-base font-semibold text-highlighted">
        {{ t('approvals.websitesTitle') }}
      </h2>
      <p id="website-origin-help" class="mt-1 text-[13px] text-muted">
        {{ t('approvals.websiteHelp') }}
      </p>
    </template>

    <UForm :state="formState" class="flex flex-col gap-1" @submit="emit('add')">
      <div class="flex items-end gap-2">
        <!-- A plain label: UFormField would replace the input's aria-invalid/aria-describedby. -->
        <div class="flex grow flex-col gap-1">
          <label for="website-origin" class="text-sm font-medium text-default">
            {{ t('approvals.websiteOrigin') }}
          </label>
          <UInput
            id="website-origin"
            class="w-full"
            data-testid="website-origin"
            placeholder="https://time.example.com"
            autocomplete="off"
            :model-value="origin"
            :disabled="disabled"
            :aria-invalid="!!errorKey"
            aria-describedby="website-origin-help website-origin-error"
            @update:model-value="emit('update:origin', String($event))"
          />
        </div>
        <UButton
          type="submit"
          icon="i-lucide-plus"
          data-testid="add-website"
          :disabled="disabled"
          :label="t('approvals.addWebsite')"
        />
      </div>
      <p id="website-origin-error" class="text-[13px] text-error" role="alert">
        <span v-if="errorKey">{{ t(errorKey) }}</span>
      </p>
    </UForm>

    <p v-if="empty" class="text-muted">{{ t('approvals.noWebsites') }}</p>
    <ul v-else class="divide-y divide-default rounded-md ring ring-default ring-inset">
      <li
        v-for="website in websites"
        :key="website.origin"
        class="flex items-center gap-2.5 py-2 ps-3 pe-2"
      >
        <UIcon name="i-lucide-globe" class="size-4.5 shrink-0 text-muted" />
        <ULink
          :to="website.origin"
          class="min-w-0 grow break-all text-highlighted hover:underline focus-visible:underline"
          :data-testid="`open-website-${website.origin}`"
          @click.prevent="openWebsite(website.origin)"
        >
          {{ website.origin }}
        </ULink>
        <template v-if="missingOrigins.includes(website.origin)">
          <UBadge color="warning" variant="soft" :label="t('approvals.noAccess')" />
          <UButton
            color="warning"
            variant="soft"
            size="xs"
            icon="i-lucide-shield-check"
            :disabled="disabled"
            :label="t('approvals.restorePermission')"
            :aria-label="`${t('approvals.restorePermission')} ${website.origin}`"
            :data-testid="`restore-website-${website.origin}`"
            @click="emit('restore', website.origin)"
          />
        </template>
        <UTooltip :text="t('approvals.revokeWebsite')">
          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            :disabled="disabled"
            :data-testid="`revoke-website-${website.origin}`"
            :aria-label="`${t('approvals.revokeWebsite')} ${website.origin}`"
            @click="requestRevoke(website.origin)"
          />
        </UTooltip>
      </li>
    </ul>

    <template #footer>
      <p class="flex items-center gap-2 text-[13px] text-muted">
        <UIcon name="i-lucide-info" class="size-4 shrink-0" />
        {{ t('app.refreshHint') }}
      </p>
    </template>
  </UCard>

  <UModal
    v-model:open="confirmOpen"
    :title="t('approvals.revokeWebsiteConfirmTitle', { website: pendingRevoke ?? '' })"
    :description="t('approvals.revokeWebsiteConfirmBody', { count: pendingTrackerCount })"
    :close="false"
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2" data-testid="revoke-website-confirm">
        <UButton
          color="neutral"
          variant="outline"
          data-testid="revoke-website-cancel"
          :label="t('approvals.cancel')"
          @click="confirmOpen = false"
        />
        <UButton
          color="error"
          icon="i-lucide-trash-2"
          data-testid="revoke-website-confirm-action"
          :label="t('approvals.revokeWebsite')"
          @click="confirmRevoke"
        />
      </div>
    </template>
  </UModal>
</template>
