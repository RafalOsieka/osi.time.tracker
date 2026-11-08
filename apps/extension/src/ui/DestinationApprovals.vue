<script setup lang="ts">
import { computed, nextTick } from 'vue';
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
import type { TrackerSystemType } from '@osi/time-tracker-remote-trackers/contracts';
import type { ActivityMap } from '../activity/activity-store.js';
import {
  destinationKey,
  type DestinationApproval,
  type WebsiteApproval,
} from '../approvals/approvals.js';
import { displayDestination, displayUrl } from '../approvals/display.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import ActivityLine from './ActivityLine.vue';
import TrackerMark from './TrackerMark.vue';

/**
 * The setup page's approved trackers: the list first, each row leading with its address and
 * last activity, and the approve form behind "Add tracker" once something is listed. Without an
 * approved website there is no form, only what to do first (REQ-420).
 */
const {
  websites,
  destinations,
  website,
  provider,
  destinationUrl,
  open,
  httpWarning,
  disabled,
  errorKey,
  missingOrigins,
  activity,
  now,
} = defineProps<{
  websites: readonly WebsiteApproval[];
  destinations: readonly DestinationApproval[];
  website: string;
  provider: TrackerSystemType;
  destinationUrl: string;
  /** The approve form is expanded although trackers are listed. */
  open: boolean;
  httpWarning: boolean;
  disabled: boolean;
  errorKey: string | null;
  missingOrigins: readonly string[];
  /** Latest operation per destination key, shown on each tracker row. */
  activity: Readonly<ActivityMap>;
  now: number;
}>();

const emit = defineEmits<{
  'update:website': [value: string];
  'update:provider': [value: TrackerSystemType];
  'update:destinationUrl': [value: string];
  'update:open': [value: boolean];
  add: [];
  revoke: [approval: DestinationApproval];
  restore: [approval: DestinationApproval];
}>();

const { t } = useExtensionI18n();
const empty = computed(() => destinations.length === 0);
const hasWebsite = computed(() => websites.length > 0);
const formShown = computed(() => hasWebsite.value && (empty.value || open));
/** With one approved website there is nothing to choose: the tracker is approved for it. */
const singleWebsite = computed(() => {
  const [only, ...others] = websites;
  return only && others.length === 0 ? only.origin : null;
});
/** Rows name their website only when there is more than one to tell apart. */
const showsWebsite = computed(() => websites.length > 1);
const canAdd = computed(() => !disabled && websites.some((item) => item.origin === website));
const formState = computed(() => ({ website, provider, destinationUrl }));
const websiteItems = computed(() => websites.map((item) => item.origin));
const providerItems = computed(() => [
  { label: t.value('approvals.openproject'), value: 'openproject' as const },
  { label: t.value('approvals.redmine'), value: 'redmine' as const },
]);
/** An example address in the shape each tracker type usually has. */
const PLACEHOLDERS = {
  openproject: 'https://openproject.example.com',
  redmine: 'https://example.com/redmine',
} as const satisfies Record<TrackerSystemType, string>;

/** The tracker as its actions name it: type, address and the website it is approved for. */
function destinationLabel(item: DestinationApproval): string {
  return `${t.value(`approvals.${item.provider}`)} ${item.origin}${item.basePath} (${t.value('approvals.forWebsite', { website: item.websiteOrigin })})`;
}

async function openForm(): Promise<void> {
  emit('update:open', true);
  await nextTick();
  document.querySelector<HTMLElement>('[data-testid="destination-url"]')?.focus();
}

function closeForm(): void {
  emit('update:destinationUrl', '');
  emit('update:open', false);
}
</script>

<template>
  <UCard as="section" aria-labelledby="destinations-title" :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h2 id="destinations-title" class="text-base font-semibold text-highlighted">
            {{ t('approvals.destinationsTitle') }}
          </h2>
          <p class="mt-1 text-[13px] text-muted">{{ t('approvals.destinationsHelp') }}</p>
        </div>
        <UButton
          v-if="hasWebsite && !formShown"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-plus"
          class="shrink-0"
          data-testid="new-destination"
          :disabled="disabled"
          :label="t('approvals.newDestination')"
          @click="openForm"
        />
      </div>
    </template>

    <ul v-if="!empty" class="divide-y divide-default">
      <li
        v-for="item in destinations"
        :key="destinationKey(item)"
        class="flex min-h-14 items-center gap-3 px-4 py-2.5 sm:px-6"
      >
        <TrackerMark :provider="item.provider" />
        <span class="flex min-w-0 grow flex-col gap-0.5">
          <span class="flex min-w-0 items-center gap-2">
            <ULink
              :to="`${item.origin}${item.basePath}`"
              target="_blank"
              class="group inline-flex min-w-0 items-center gap-1 font-medium text-highlighted hover:text-primary focus-visible:text-primary"
              :data-testid="`open-destination-${destinationKey(item)}`"
            >
              <span class="truncate group-hover:underline">{{ displayDestination(item) }}</span>
              <UIcon
                name="i-lucide-external-link"
                class="size-3.5 shrink-0 text-dimmed group-hover:text-primary"
                aria-hidden="true"
              />
              <span class="sr-only">
                {{ t(`approvals.${item.provider}`) }} ({{ t('app.opensInNewTab') }})
              </span>
            </ULink>
            <UBadge
              v-if="missingOrigins.includes(item.origin)"
              color="warning"
              variant="soft"
              size="sm"
              class="shrink-0"
              icon="i-lucide-shield-alert"
              :label="t('approvals.noAccess')"
            />
          </span>
          <span v-if="showsWebsite" class="truncate text-xs text-muted">
            {{ t('approvals.websiteLine', { website: displayUrl(item.websiteOrigin) }) }}
          </span>
          <span
            v-if="missingOrigins.includes(item.websiteOrigin)"
            class="text-xs text-warning"
            :data-testid="`website-access-${destinationKey(item)}`"
          >
            {{ t('approvals.websitePermissionMissing') }}
          </span>
          <ActivityLine
            :record="activity[destinationKey(item)]"
            :now="now"
            :data-testid="`activity-${destinationKey(item)}`"
          />
        </span>
        <div class="flex shrink-0 items-center gap-2">
          <UButton
            v-if="missingOrigins.includes(item.origin)"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-shield-check"
            :disabled="disabled"
            :label="t('approvals.restorePermission')"
            :aria-label="`${t('approvals.restorePermission')} ${destinationLabel(item)}`"
            :data-testid="`restore-destination-${destinationKey(item)}`"
            @click="emit('restore', item)"
          />
          <UTooltip :text="t('approvals.revokeDestination')">
            <UButton
              color="error"
              variant="soft"
              square
              icon="i-lucide-trash-2"
              :ui="{ base: 'size-8 justify-center', leadingIcon: 'size-4' }"
              :disabled="disabled"
              :data-testid="`revoke-destination-${destinationKey(item)}`"
              :aria-label="`${t('approvals.revokeDestination')} ${destinationLabel(item)}`"
              @click="emit('revoke', item)"
            />
          </UTooltip>
        </div>
      </li>
    </ul>

    <div
      v-if="!hasWebsite"
      class="flex items-start gap-3 px-4 py-4 sm:px-6 sm:py-5"
      data-testid="destination-website-required"
    >
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-md bg-elevated text-muted"
        aria-hidden="true"
      >
        <UIcon name="i-lucide-lock" class="size-4" />
      </span>
      <p class="pt-1.5 text-sm text-muted">{{ t('approvals.websiteRequired') }}</p>
    </div>

    <div
      v-else-if="formShown"
      class="px-4 py-4 sm:px-6 sm:py-5"
      :class="{ 'border-t border-default': !empty }"
    >
      <UForm :state="formState" class="flex flex-col gap-4" @submit="emit('add')">
        <p
          v-if="singleWebsite"
          class="flex items-center gap-1.5 text-[13px] text-muted"
          data-testid="destination-website-single"
        >
          <UIcon name="i-lucide-globe" class="size-4 shrink-0" aria-hidden="true" />
          {{ t('approvals.forWebsiteLine', { website: displayUrl(singleWebsite) }) }}
        </p>
        <UFormField v-else :label="t('approvals.website')" name="website">
          <USelect
            id="destination-website"
            class="w-full"
            data-testid="destination-website"
            :placeholder="t('approvals.websitePlaceholder')"
            :model-value="website"
            :items="websiteItems"
            :disabled="disabled"
            @update:model-value="emit('update:website', $event)"
          />
        </UFormField>
        <div class="grid grid-cols-[11rem_1fr] items-start gap-3">
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
          <UFormField
            :label="t('approvals.destinationUrl')"
            name="destinationUrl"
            :help="t(httpWarning ? 'approvals.httpWarning' : 'approvals.destinationHelp')"
            :error="errorKey ? t(errorKey) : undefined"
          >
            <UInput
              id="destination-url"
              class="w-full"
              data-testid="destination-url"
              autocomplete="off"
              :placeholder="PLACEHOLDERS[provider]"
              :model-value="destinationUrl"
              :disabled="disabled"
              :color="httpWarning ? 'warning' : undefined"
              :highlight="httpWarning || undefined"
              @update:model-value="emit('update:destinationUrl', String($event))"
            />
            <template #help>
              <span
                v-if="httpWarning"
                class="flex items-start gap-1.5 text-warning"
                role="status"
                data-testid="http-warning"
              >
                <UIcon name="i-lucide-lock-open" class="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <span class="font-medium">{{ t('approvals.httpTitle') }}</span>
                  {{ t('approvals.httpWarning') }}
                </span>
              </span>
              <template v-else>{{ t('approvals.destinationHelp') }}</template>
            </template>
            <template v-if="errorKey" #error="{ error }">
              <span role="alert" data-testid="destination-url-error">{{ error }}</span>
            </template>
          </UFormField>
        </div>
        <div class="flex gap-2">
          <UButton
            type="submit"
            icon="i-lucide-check"
            data-testid="add-destination"
            :color="httpWarning ? 'warning' : 'primary'"
            :variant="httpWarning ? 'outline' : 'solid'"
            :disabled="!canAdd"
            :label="t(httpWarning ? 'approvals.approveDespiteHttp' : 'approvals.addDestination')"
          />
          <UButton
            v-if="!empty"
            color="neutral"
            variant="ghost"
            data-testid="close-destination-form"
            :label="t('approvals.cancel')"
            @click="closeForm"
          />
        </div>
      </UForm>
    </div>
  </UCard>
</template>
