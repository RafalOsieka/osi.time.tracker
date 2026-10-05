<script setup lang="ts">
import { computed } from 'vue';
import UAlert from '@nuxt/ui/components/Alert.vue';
import UAvatar from '@nuxt/ui/components/Avatar.vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import UForm from '@nuxt/ui/components/Form.vue';
import UFormField from '@nuxt/ui/components/FormField.vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import ULink from '@nuxt/ui/components/Link.vue';
import USelect from '@nuxt/ui/components/Select.vue';
import UTooltip from '@nuxt/ui/components/Tooltip.vue';
import type { TrackerSystemType } from '@osi/remote-trackers/contracts';
import type { DestinationApproval, WebsiteApproval } from '../approvals/approvals.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';

const {
  websites,
  destinations,
  website,
  provider,
  destinationUrl,
  httpWarning,
  disabled,
  errorKey,
  missingOrigins,
} = defineProps<{
  websites: readonly WebsiteApproval[];
  destinations: readonly DestinationApproval[];
  website: string;
  provider: TrackerSystemType;
  destinationUrl: string;
  httpWarning: boolean;
  disabled: boolean;
  errorKey: string | null;
  missingOrigins: readonly string[];
}>();

const emit = defineEmits<{
  'update:website': [value: string];
  'update:provider': [value: TrackerSystemType];
  'update:destinationUrl': [value: string];
  add: [];
  revoke: [approval: DestinationApproval];
  restore: [approval: DestinationApproval];
}>();

const { t } = useExtensionI18n();
const empty = computed(() => destinations.length === 0);
/** With one approved website there is nothing to choose: the tracker is approved for it. */
const singleWebsite = computed(() => {
  const [only, ...others] = websites;
  return only && others.length === 0 ? only.origin : null;
});
const canAdd = computed(() => !disabled && websites.some((item) => item.origin === website));
const formState = computed(() => ({ website, provider, destinationUrl }));
const websiteItems = computed(() => websites.map((item) => item.origin));
const providerItems = computed(() => [
  { label: t.value('approvals.openproject'), value: 'openproject' as const },
  { label: t.value('approvals.redmine'), value: 'redmine' as const },
]);
const providerInitials = { openproject: 'OP', redmine: 'RM' } as const;

const destinationKey = (item: DestinationApproval) =>
  `${item.websiteOrigin}|${item.provider}|${item.origin}${item.basePath}`;

function destinationLabel(item: DestinationApproval): string {
  return `${t.value('approvals.website')}: ${item.websiteOrigin} — ${t.value(`approvals.${item.provider}`)} ${item.origin}${item.basePath}`;
}
</script>

<template>
  <UCard as="section" aria-labelledby="destinations-title" :ui="{ body: 'flex flex-col gap-4' }">
    <template #header>
      <h2 id="destinations-title" class="text-base font-semibold text-highlighted">
        {{ t('approvals.destinationsTitle') }}
      </h2>
      <p id="destination-url-help" class="mt-1 text-[13px] text-muted">
        {{ t('approvals.destinationHelp') }}
      </p>
    </template>

    <UForm :state="formState" class="flex flex-col gap-3" @submit="emit('add')">
      <p
        v-if="singleWebsite"
        class="flex items-center gap-1.5 text-[13px] text-muted"
        data-testid="destination-website-single"
      >
        <UIcon name="i-lucide-globe" class="size-4 shrink-0" aria-hidden="true" />
        {{ t('approvals.forWebsite', { website: singleWebsite }) }}
      </p>
      <div class="grid grid-cols-2 gap-3">
        <UFormField v-if="!singleWebsite" :label="t('approvals.website')" name="website">
          <USelect
            id="destination-website"
            class="w-full"
            data-testid="destination-website"
            :model-value="website"
            :items="websiteItems"
            :disabled="disabled || websites.length === 0"
            aria-describedby="destination-website-help"
            @update:model-value="emit('update:website', $event)"
          />
        </UFormField>
        <UFormField :label="t('approvals.provider')" name="provider">
          <USelect
            id="destination-provider"
            class="w-full"
            data-testid="destination-provider"
            value-key="value"
            :model-value="provider"
            :items="providerItems"
            :disabled="disabled"
            @update:model-value="emit('update:provider', $event)"
          />
        </UFormField>
      </div>
      <p v-if="websites.length === 0" id="destination-website-help" class="text-[13px] text-muted">
        {{ t('approvals.websiteRequired') }}
      </p>
      <!-- A plain label: UFormField would replace the input's aria-invalid/aria-describedby. -->
      <div class="flex flex-col gap-1">
        <label for="destination-url" class="text-sm font-medium text-default">
          {{ t('approvals.destinationUrl') }}
        </label>
        <UInput
          id="destination-url"
          class="w-full"
          data-testid="destination-url"
          placeholder="https://tracker.example.com/redmine"
          autocomplete="off"
          :model-value="destinationUrl"
          :disabled="disabled"
          :aria-invalid="!!errorKey"
          aria-describedby="destination-url-help destination-url-error"
          @update:model-value="emit('update:destinationUrl', String($event))"
        />
      </div>
      <p id="destination-url-error" class="text-[13px] text-error" role="alert">
        <span v-if="errorKey">{{ t(errorKey) }}</span>
      </p>
      <UAlert
        v-if="httpWarning"
        data-testid="http-warning"
        role="status"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :description="t('approvals.httpWarning')"
      />
      <div>
        <UButton
          type="submit"
          icon="i-lucide-plus"
          data-testid="add-destination"
          :disabled="!canAdd"
          :label="t('approvals.addDestination')"
        />
      </div>
    </UForm>

    <p v-if="empty" class="text-muted">{{ t('approvals.noDestinations') }}</p>
    <ul v-else class="divide-y divide-default rounded-md ring ring-default ring-inset">
      <li
        v-for="item in destinations"
        :key="destinationKey(item)"
        class="flex items-center gap-2.5 py-2 ps-3 pe-2"
      >
        <UAvatar :text="providerInitials[item.provider]" class="rounded-md" aria-hidden="true" />
        <span class="flex min-w-0 grow flex-col">
          <ULink
            :to="`${item.origin}${item.basePath}`"
            target="_blank"
            class="break-all text-highlighted hover:underline focus-visible:underline"
            :data-testid="`open-destination-${destinationKey(item)}`"
          >
            {{ item.origin }}{{ item.basePath }}
            <span class="sr-only">({{ t('app.opensInNewTab') }})</span>
          </ULink>
          <span class="text-xs break-all text-muted">
            {{ t(`approvals.${item.provider}`) }}
            <span class="before:me-1 before:content-['·']">
              {{ t('approvals.website') }}: {{ item.websiteOrigin }}
            </span>
          </span>
          <span v-if="missingOrigins.includes(item.websiteOrigin)" class="text-xs text-warning">
            {{ t('approvals.websitePermissionMissing') }}
          </span>
        </span>
        <template v-if="missingOrigins.includes(item.origin)">
          <UBadge color="warning" variant="soft" :label="t('approvals.noAccess')" />
          <UButton
            color="warning"
            variant="soft"
            size="xs"
            icon="i-lucide-shield-check"
            :disabled="disabled"
            :label="t('approvals.restorePermission')"
            :aria-label="`${t('approvals.restorePermission')} ${destinationLabel(item)}`"
            :data-testid="`restore-destination-${destinationKey(item)}`"
            @click="emit('restore', item)"
          />
        </template>
        <UTooltip :text="t('approvals.revokeDestination')">
          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            :disabled="disabled"
            :data-testid="`revoke-destination-${destinationKey(item)}`"
            :aria-label="`${t('approvals.revokeDestination')} ${destinationLabel(item)}`"
            @click="emit('revoke', item)"
          />
        </UTooltip>
      </li>
    </ul>
  </UCard>
</template>
