<script setup lang="ts">
import {
  orderReadinessTrackers,
  type ExtensionAggregateState,
  type ExtensionConnectionState,
} from '~/utils/remote/extension-readiness';

interface StatusPresentation {
  label: string;
  /** A status mark, only where the state matters; a plain statement goes without one. */
  icon?: string;
  iconClass?: string;
}

const { collapsed = false } = defineProps<{ collapsed?: boolean }>();

const { t } = useI18n();
const { snapshot, aggregate, recheck } = useExtensionReadiness();
const suggestion = useExtensionSuggestion(recheck);
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
    // Not required is not a problem, so it shows the extension glyph rather than a status mark.
    neutral: 'i-lucide-puzzle',
    checking: 'i-lucide-loader-circle',
    red: 'i-lucide-circle-alert',
    orange: 'i-lucide-triangle-alert',
    green: 'i-lucide-circle-check',
  } as const satisfies Record<ExtensionAggregateState, string>;
  return icons[aggregate.value];
});

const statusIconClass = computed(() => {
  const classes = {
    neutral: 'text-muted',
    checking: 'animate-spin text-muted',
    red: 'text-error',
    orange: 'text-warning',
    green: 'text-success',
  } as const satisfies Record<ExtensionAggregateState, string>;
  return classes[aggregate.value];
});

const hasRequiredTracker = computed(() =>
  orderedTrackers.value.some((tracker) => !tracker.directBrowserAccess),
);

const websiteStatus = computed((): StatusPresentation => {
  // The one plain statement when no Tracker needs the extension; each Tracker row adds its mode.
  if (!hasRequiredTracker.value) return { label: t('layout.extensionStatus.notRequiredSummary') };
  const presentations = {
    checking: {
      label: t('layout.extensionStatus.checking'),
      icon: 'i-lucide-loader-circle',
      iconClass: 'text-muted animate-spin',
    },
    unavailable: {
      label: t('layout.extensionStatus.unavailable'),
      icon: 'i-lucide-unplug',
      iconClass: 'text-error',
    },
    incompatible: {
      label: t('layout.extensionStatus.incompatible'),
      icon: 'i-lucide-circle-alert',
      iconClass: 'text-error',
    },
    websiteUnapproved: {
      label: t('layout.extensionStatus.websiteUnapproved'),
      icon: 'i-lucide-circle-x',
      iconClass: 'text-error',
    },
    ready: {
      label: t('layout.extensionStatus.websiteApproved'),
      icon: 'i-lucide-circle-check',
      iconClass: 'text-success',
    },
  } as const satisfies Record<ExtensionConnectionState, StatusPresentation>;
  return presentations[snapshot.value.connection];
});

const destinationRows = computed(() =>
  orderedTrackers.value.map((tracker) => ({
    id: tracker.id,
    name: tracker.name,
    required: !tracker.directBrowserAccess,
    status: destinationStatus(tracker),
    destination: { provider: tracker.systemType, baseUrl: tracker.baseUrl },
    // Approval stays in the extension; OSI can only ask for it once the bridge is up (REQ-316).
    canRequest:
      !tracker.directBrowserAccess &&
      tracker.destinationApproved === false &&
      snapshot.value.connection === 'ready',
  })),
);

function destinationStatus(tracker: {
  directBrowserAccess: boolean;
  destinationApproved: boolean | null;
}): StatusPresentation {
  // A direct connection is not a state to watch, so it reads as plain text without a mark.
  if (tracker.directBrowserAccess) return { label: t('layout.extensionStatus.destinationDirect') };
  if (tracker.destinationApproved === true) {
    return {
      label: t('layout.extensionStatus.destinationApproved'),
      icon: 'i-lucide-circle-check',
      iconClass: 'text-success',
    };
  }
  if (tracker.destinationApproved === false) {
    return {
      label: t('layout.extensionStatus.destinationUnapproved'),
      icon: 'i-lucide-circle-x',
      iconClass: 'text-error',
    };
  }
  if (snapshot.value.connection === 'checking') {
    return {
      label: t('layout.extensionStatus.checking'),
      icon: 'i-lucide-loader-circle',
      iconClass: 'text-muted animate-spin',
    };
  }
  return {
    label: t('layout.extensionStatus.websiteUnknown'),
    icon: 'i-lucide-circle-help',
    iconClass: 'text-muted',
  };
}

function openDetails() {
  detailsOpen.value = true;
}
</script>

<template>
  <div class="flex w-full min-w-0" data-testid="extension-status-footer">
    <UPopover
      v-model:open="detailsOpen"
      mode="hover"
      enable-touch
      :open-delay="50"
      :close-delay="200"
      class="w-full min-w-0"
      :content="{ side: 'right', align: 'end', sideOffset: 24 }"
      :ui="{ content: 'max-w-80 p-3' }"
    >
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        block
        class="w-full min-w-0 gap-2 font-normal text-muted"
        :class="collapsed ? 'justify-center px-1' : 'justify-start px-1'"
        :aria-label="t('layout.extensionStatus.rowAria', { status: statusLabel })"
        data-testid="extension-status-trigger"
        @focus="openDetails"
      >
        <template #leading>
          <!-- As wide as the account avatar above, so icon and label line up with it. -->
          <span class="inline-flex h-5 w-8 shrink-0 items-center justify-center">
            <UIcon
              :name="statusIcon"
              class="size-4"
              :class="statusIconClass"
              data-testid="extension-status-icon"
            />
          </span>
        </template>
        <span
          v-if="!collapsed"
          class="min-w-0 truncate text-xs"
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
          class="grid gap-3"
          data-testid="extension-status-popover"
          role="dialog"
          :aria-label="t('layout.extensionStatus.title')"
        >
          <h2
            class="m-0 flex items-center gap-2 text-sm font-semibold"
            data-testid="extension-status-title"
          >
            <UIcon name="i-lucide-puzzle" class="size-4 shrink-0 text-primary" />
            <span class="min-w-0">{{ t('layout.extensionStatus.title') }}</span>
          </h2>

          <p
            class="m-0 flex items-start gap-2 text-sm"
            :class="websiteStatus.icon ? undefined : 'text-muted'"
            data-testid="extension-status-website"
          >
            <span
              v-if="websiteStatus.icon"
              class="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center overflow-hidden"
            >
              <UIcon :name="websiteStatus.icon" class="size-4" :class="websiteStatus.iconClass" />
            </span>
            <span class="min-w-0">{{ websiteStatus.label }}</span>
          </p>

          <ul
            v-if="destinationRows.length > 0"
            class="m-0 grid max-h-56 list-none gap-2 overflow-x-hidden overflow-y-auto p-0"
            data-testid="extension-status-destinations"
            :aria-label="t('layout.extensionStatus.destinationsLabel')"
          >
            <li
              v-for="tracker in destinationRows"
              :key="tracker.id"
              class="flex items-start gap-2"
              :data-testid="`extension-status-destination-${tracker.id}`"
              :data-required="tracker.required ? 'required' : 'optional'"
            >
              <!-- The Tracker's type mark gives each row its identity; status marks sit by the text. -->
              <TrackerTypeMark :system-type="tracker.destination.provider" class="mt-px" />
              <div class="grid min-w-0 gap-0.5">
                <p class="m-0 truncate text-sm">{{ tracker.name }}</p>
                <p class="m-0 flex items-start gap-1.5 text-sm text-muted">
                  <UIcon
                    v-if="tracker.status.icon"
                    :name="tracker.status.icon"
                    class="mt-0.5 size-4 shrink-0"
                    :class="tracker.status.iconClass"
                  />
                  <span class="min-w-0">{{ tracker.status.label }}</span>
                </p>
                <ExtensionApprovalRequest
                  v-if="tracker.canRequest"
                  :state="suggestion.states.value[suggestionKey(tracker.destination)]"
                  :test-id="`extension-status-request-${tracker.id}`"
                  @request="suggestion.request(tracker.destination)"
                />
              </div>
            </li>
          </ul>
        </div>
      </template>
    </UPopover>
  </div>
</template>
