<script setup lang="ts">
import {
  orderReadinessTrackers,
  type ExtensionAggregateState,
} from '~/utils/remote/extension-readiness';

const { collapsed = false } = defineProps<{ collapsed?: boolean }>();

const { t } = useI18n();
const { snapshot, aggregate, recheck, approveDestination } = useExtensionReadiness();
const detailsOpen = shallowRef(false);
const orderedTrackers = computed(() => orderReadinessTrackers(snapshot.value.trackers));

const statusLabel = computed(() => {
  const labels = {
    neutral: t('layout.extensionStatus.notRequired'),
    checking: t('layout.extensionStatus.checking'),
    red: t('layout.extensionStatus.invalid'),
    orange: t('layout.extensionStatus.partial'),
    green: t('layout.extensionStatus.ready'),
  } as const satisfies Record<ExtensionAggregateState, string>;
  return labels[aggregate.value];
});

const statusColor = computed(() => {
  const colors = {
    neutral: 'neutral',
    checking: 'neutral',
    red: 'error',
    orange: 'warning',
    green: 'success',
  } as const satisfies Record<ExtensionAggregateState, 'neutral' | 'error' | 'warning' | 'success'>;
  return colors[aggregate.value];
});

const statusIcon = computed(() => {
  const icons = {
    neutral: 'i-lucide-circle-minus',
    checking: 'i-lucide-loader-circle',
    red: 'i-lucide-circle-alert',
    orange: 'i-lucide-triangle-alert',
    green: 'i-lucide-circle-check',
  } as const satisfies Record<ExtensionAggregateState, string>;
  return icons[aggregate.value];
});

const connectionLabel = computed(() => {
  if (snapshot.value.connection === 'unavailable') return t('error.extensionUnavailable');
  if (snapshot.value.connection === 'incompatible') return t('error.extensionIncompatible');
  if (snapshot.value.connection === 'websiteUnapproved') {
    return t('error.extensionOriginUnapproved');
  }
  if (snapshot.value.connection === 'checking') return t('layout.extensionStatus.checking');
  return t('layout.extensionStatus.connected');
});

const websiteLabel = computed(() => {
  if (snapshot.value.connection === 'websiteUnapproved') {
    return t('layout.extensionStatus.websiteUnapproved');
  }
  if (snapshot.value.connection === 'ready') return t('layout.extensionStatus.websiteApproved');
  return t('layout.extensionStatus.websiteUnknown');
});

function openDetails() {
  detailsOpen.value = true;
}

function toggleDetails() {
  detailsOpen.value = !detailsOpen.value;
}
</script>

<template>
  <div
    class="flex w-full min-w-0"
    :class="collapsed ? 'justify-center' : undefined"
    data-testid="extension-status-footer"
  >
    <UPopover
      v-model:open="detailsOpen"
      mode="hover"
      enable-touch
      :content="{ side: 'top', align: collapsed ? 'center' : 'start', sideOffset: 8 }"
      :ui="{ content: 'max-w-80 p-3' }"
    >
      <UButton
        color="neutral"
        variant="ghost"
        :block="!collapsed"
        :square="collapsed"
        class="w-full min-w-0 justify-start"
        :icon="statusIcon"
        :aria-label="t('layout.extensionStatus.rowAria', { status: statusLabel })"
        data-testid="extension-status-trigger"
        @focus="openDetails"
        @click="toggleDetails"
      >
        <span
          v-if="!collapsed"
          class="min-w-0 truncate text-sm"
          data-testid="extension-status-label"
        >
          {{ statusLabel }}
        </span>
        <span
          class="sr-only"
          data-testid="extension-status-semantics"
          :data-state="aggregate"
          :data-color="statusColor"
        >
          {{ statusLabel }}
        </span>
      </UButton>

      <template #content>
        <div
          class="grid max-h-64 gap-3 overflow-auto"
          data-testid="extension-status-popover"
          role="dialog"
          :aria-label="t('layout.extensionStatus.rowAria', { status: statusLabel })"
        >
          <div class="grid gap-1 text-sm">
            <p data-testid="extension-status-connection">
              {{ t('layout.extensionStatus.connectionLabel') }}: {{ connectionLabel }}
            </p>
            <p data-testid="extension-status-website">
              {{ t('layout.extensionStatus.websiteLabel') }}: {{ websiteLabel }}
            </p>
          </div>

          <ul
            class="m-0 grid list-none gap-2 p-0"
            data-testid="extension-status-destinations"
            :aria-label="t('layout.extensionStatus.destinationsLabel')"
          >
            <li
              v-for="tracker in orderedTrackers"
              :key="tracker.id"
              class="grid gap-1"
              :data-testid="`extension-status-destination-${tracker.id}`"
              :data-required="tracker.directBrowserAccess ? 'optional' : 'required'"
            >
              <p class="text-sm">
                {{ tracker.name }}
                <span class="text-muted">
                  ({{
                    tracker.directBrowserAccess
                      ? t('layout.extensionStatus.optional')
                      : t('layout.extensionStatus.required')
                  }})
                </span>
              </p>
              <p class="text-sm text-muted">
                {{
                  tracker.destinationApproved
                    ? t('layout.extensionStatus.destinationApproved')
                    : t('layout.extensionStatus.destinationUnapproved')
                }}
              </p>
              <UButton
                v-if="!tracker.destinationApproved"
                type="button"
                color="neutral"
                variant="outline"
                size="xs"
                :label="t('layout.extensionStatus.approveButton')"
                :data-testid="`extension-status-approve-${tracker.id}`"
                @click="approveDestination(tracker.id)"
              />
            </li>
          </ul>

          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="xs"
            :label="t('layout.extensionStatus.recheckButton')"
            data-testid="extension-status-recheck"
            @click="recheck"
          />
        </div>
      </template>
    </UPopover>
  </div>
</template>
