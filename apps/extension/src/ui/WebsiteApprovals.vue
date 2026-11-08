<script setup lang="ts">
import { computed, nextTick, shallowRef } from 'vue';
import UBadge from '@nuxt/ui/components/Badge.vue';
import UButton from '@nuxt/ui/components/Button.vue';
import UCard from '@nuxt/ui/components/Card.vue';
import UForm from '@nuxt/ui/components/Form.vue';
import UFormField from '@nuxt/ui/components/FormField.vue';
import UIcon from '@nuxt/ui/components/Icon.vue';
import UInput from '@nuxt/ui/components/Input.vue';
import ULink from '@nuxt/ui/components/Link.vue';
import UModal from '@nuxt/ui/components/Modal.vue';
import UTooltip from '@nuxt/ui/components/Tooltip.vue';
import type { DestinationApproval, WebsiteApproval } from '../approvals/approvals.js';
import { displayDestination, displayUrl } from '../approvals/display.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';
import { openWebsite } from './open-website.js';
import TrackerMark from './TrackerMark.vue';

/**
 * The setup page's approved OSI websites: the list first, the approve form behind "Add website"
 * once something is listed (always open, and the section titled as the task, while the list is
 * empty). Removing a website that still has trackers asks first and lists them (REQ-413).
 */
const {
  websites,
  destinations,
  origin,
  open,
  handedOff,
  disabled,
  errorKey,
  missingOrigins,
  rowRestore,
} = defineProps<{
  websites: readonly WebsiteApproval[];
  destinations: readonly DestinationApproval[];
  origin: string;
  /** The approve form is expanded although websites are listed. */
  open: boolean;
  /** The popup handed the current address over from the active tab (REQ-415). */
  handedOff: boolean;
  disabled: boolean;
  errorKey: string | null;
  missingOrigins: readonly string[];
  /** Rows offer their own restore; off while the page's alert restores the only lost one. */
  rowRestore: boolean;
}>();

const emit = defineEmits<{
  'update:origin': [value: string];
  'update:open': [value: boolean];
  add: [];
  revoke: [origin: string];
  restore: [origin: string];
}>();

const { t } = useExtensionI18n();
const empty = computed(() => websites.length === 0);
const formShown = computed(() => empty.value || open);
const formState = computed(() => ({ origin }));
/** The loopback exception only matters once someone types a plain-HTTP address. */
const help = computed(() =>
  origin.trim().startsWith('http://')
    ? t.value('approvals.websiteHttpHelp')
    : t.value('approvals.websiteHelp'),
);

/**
 * Website whose removal waits for confirmation because trackers would go with it. It outlives
 * `confirmOpen` so the dialog keeps its text while the close animation runs.
 */
const pendingRevoke = shallowRef<string | null>(null);
const pendingTrackers = computed(() =>
  destinations.filter((item) => item.websiteOrigin === pendingRevoke.value),
);
const confirmOpen = shallowRef(false);
/** The remove tile stays pressed while its confirmation is open, like the web app's tiles. */
const PRESSED =
  'bg-error/20 ring-1 ring-error/40 ring-inset dark:bg-red-900/85 dark:ring-red-400/60';

function requestRevoke(website: string): void {
  if (!destinations.some((item) => item.websiteOrigin === website)) {
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

async function openForm(): Promise<void> {
  emit('update:open', true);
  await nextTick();
  document.querySelector<HTMLElement>('[data-testid="website-origin"]')?.focus();
}

function closeForm(): void {
  emit('update:origin', '');
  emit('update:open', false);
}
</script>

<template>
  <UCard
    as="section"
    aria-labelledby="websites-title"
    :ui="{ header: 'sm:py-5', body: 'p-0 sm:p-0' }"
  >
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <h2 id="websites-title" class="text-base font-semibold text-highlighted">
            {{ t(empty ? 'approvals.websitesEmptyTitle' : 'approvals.websitesTitle') }}
          </h2>
          <p class="mt-0.5 text-sm text-muted">
            {{ t(empty ? 'approvals.websitesEmptyHelp' : 'approvals.websitesHelp') }}
          </p>
        </div>
        <UButton
          v-if="!formShown"
          color="neutral"
          variant="outline"
          icon="i-lucide-plus"
          class="shrink-0"
          data-testid="new-website"
          :disabled="disabled"
          :label="t('approvals.newWebsite')"
          @click="openForm"
        />
      </div>
    </template>

    <ul v-if="!empty" class="divide-y divide-default">
      <li
        v-for="website in websites"
        :key="website.origin"
        class="flex min-h-11 items-center gap-3 px-4 py-1.5 sm:px-6"
      >
        <span
          class="inline-flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary-100/50 text-primary dark:bg-primary/10"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-globe" class="size-3.5" />
        </span>
        <span class="flex min-w-0 grow items-center gap-2">
          <ULink
            :to="website.origin"
            class="group inline-flex min-w-0 items-center gap-1 font-medium text-highlighted hover:text-primary focus-visible:text-primary"
            :aria-label="`${t('approvals.openWebsite')} ${website.origin}`"
            :data-testid="`open-website-${website.origin}`"
            @click.prevent="openWebsite(website.origin)"
          >
            <span class="truncate group-hover:underline">{{ displayUrl(website.origin) }}</span>
            <UIcon
              name="i-lucide-arrow-up-right"
              class="size-3.5 shrink-0 text-dimmed group-hover:text-primary"
              aria-hidden="true"
            />
          </ULink>
          <UBadge
            v-if="missingOrigins.includes(website.origin)"
            color="warning"
            variant="soft"
            size="sm"
            class="shrink-0"
            icon="i-lucide-shield-alert"
            :label="t('approvals.noAccess')"
          />
        </span>
        <div class="flex shrink-0 items-center gap-2">
          <UButton
            v-if="rowRestore && missingOrigins.includes(website.origin)"
            color="neutral"
            variant="outline"
            icon="i-lucide-shield-check"
            :disabled="disabled"
            :label="t('approvals.restorePermission')"
            :aria-label="`${t('approvals.restorePermission')} ${website.origin}`"
            :data-testid="`restore-website-${website.origin}`"
            @click="emit('restore', website.origin)"
          />
          <UTooltip :text="t('approvals.revokeWebsite')">
            <UButton
              color="error"
              variant="soft"
              square
              icon="i-lucide-trash-2"
              :ui="{ base: 'size-8 justify-center', leadingIcon: 'size-4' }"
              :disabled="disabled"
              :class="{ [PRESSED]: confirmOpen && pendingRevoke === website.origin }"
              :aria-expanded="confirmOpen && pendingRevoke === website.origin"
              :data-testid="`revoke-website-${website.origin}`"
              :aria-label="`${t('approvals.revokeWebsite')} ${website.origin}`"
              @click="requestRevoke(website.origin)"
            />
          </UTooltip>
        </div>
      </li>
    </ul>

    <div
      v-if="formShown"
      class="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5"
      :class="{ 'border-t border-default': !empty }"
    >
      <h3 v-if="!empty" class="text-sm font-semibold text-highlighted">
        {{ t('approvals.websiteFormTitle') }}
      </h3>
      <UForm :state="formState" class="flex flex-col gap-4" @submit="emit('add')">
        <UFormField
          :label="t('approvals.websiteOrigin')"
          name="origin"
          :help="handedOff ? t('approvals.websiteHandoff') : help"
          :error="errorKey ? t(errorKey) : undefined"
          :ui="{ help: 'text-sm', error: 'text-sm' }"
        >
          <UInput
            id="website-origin"
            class="w-full"
            data-testid="website-origin"
            placeholder="https://time.example.com"
            autocomplete="off"
            :model-value="origin"
            :disabled="disabled"
            @update:model-value="emit('update:origin', String($event))"
          />
          <!-- The popup's handoff explains the pre-filled address right where it is read. -->
          <template v-if="handedOff" #help="{ help: handoff }">
            <span data-testid="website-handoff">{{ handoff }}</span>
          </template>
          <template v-if="errorKey" #error="{ error }">
            <span role="alert" class="flex items-start gap-1.5" data-testid="website-origin-error">
              <UIcon
                name="i-lucide-circle-alert"
                class="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {{ error }}
            </span>
          </template>
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            v-if="!empty"
            color="neutral"
            variant="outline"
            data-testid="close-website-form"
            :label="t('approvals.cancel')"
            @click="closeForm"
          />
          <UButton
            type="submit"
            icon="i-lucide-check"
            data-testid="add-website"
            :disabled="disabled"
            :label="t('approvals.addWebsite')"
          />
        </div>
      </UForm>
    </div>
  </UCard>

  <UModal
    v-model:open="confirmOpen"
    :title="t('approvals.revokeWebsiteConfirmTitle', { website: displayUrl(pendingRevoke ?? '') })"
    :close="false"
  >
    <template #body>
      <div class="flex items-start gap-3">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-md bg-error/10 text-error"
          aria-hidden="true"
        >
          <UIcon name="i-lucide-trash-2" class="size-5" />
        </span>
        <div class="flex min-w-0 flex-col gap-3 pt-1.5 text-sm text-toned">
          <p class="m-0" data-testid="revoke-website-description">
            {{
              pendingTrackers.length === 1
                ? t('approvals.revokeWebsiteConfirmBodyOne')
                : t('approvals.revokeWebsiteConfirmBody', { count: pendingTrackers.length })
            }}
          </p>
          <ul class="m-0 flex flex-col gap-1.5 p-0" data-testid="revoke-website-trackers">
            <li
              v-for="item in pendingTrackers"
              :key="`${item.provider}${item.origin}${item.basePath}`"
              class="flex items-center gap-2 font-medium text-highlighted"
            >
              <TrackerMark :provider="item.provider" />
              <span class="truncate">{{ displayDestination(item) }}</span>
            </li>
          </ul>
          <p class="m-0 text-muted">{{ t('approvals.revokeWebsiteConfirmSafe') }}</p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2" data-testid="revoke-website-confirm">
        <UButton
          color="neutral"
          variant="outline"
          data-testid="revoke-website-cancel"
          :label="t('approvals.cancel')"
          @click="confirmOpen = false"
        />
        <UButton
          color="error"
          data-testid="revoke-website-confirm-action"
          :label="t('approvals.revokeWebsite')"
          @click="confirmRevoke"
        />
      </div>
    </template>
  </UModal>
</template>
