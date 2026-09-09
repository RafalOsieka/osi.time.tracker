<script setup lang="ts">
import { computed } from 'vue';
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
const destinationKey = (item: DestinationApproval) =>
  `${item.websiteOrigin}|${item.provider}|${item.origin}${item.basePath}`;
const canAdd = computed(() => !disabled && websites.some((item) => item.origin === website));

function destinationLabel(item: DestinationApproval): string {
  return `${t.value('approvals.website')}: ${item.websiteOrigin} — ${t.value(`approvals.${item.provider}`)} ${item.origin}${item.basePath}`;
}

function onWebsiteChange(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLSelectElement) emit('update:website', target.value);
}

function onProviderChange(event: Event): void {
  const target = event.target;
  if (
    target instanceof HTMLSelectElement &&
    (target.value === 'openproject' || target.value === 'redmine')
  ) {
    emit('update:provider', target.value);
  }
}

function onUrlInput(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLInputElement) emit('update:destinationUrl', target.value);
}

function onAdd(event: Event): void {
  event.preventDefault();
  emit('add');
}
</script>

<template>
  <section class="panel" aria-labelledby="destinations-title">
    <h2 id="destinations-title" class="panel-title">{{ t('approvals.destinationsTitle') }}</h2>
    <form class="form" @submit="onAdd">
      <label class="field">
        <span class="field-label">{{ t('approvals.website') }}</span>
        <select
          class="field-input"
          data-testid="destination-website"
          :value="website"
          :disabled="disabled || websites.length === 0"
          aria-describedby="destination-website-help"
          @change="onWebsiteChange"
        >
          <option v-for="item in websites" :key="item.origin" :value="item.origin">
            {{ item.origin }}
          </option>
        </select>
      </label>
      <p v-if="websites.length === 0" id="destination-website-help" class="empty">
        {{ t('approvals.websiteRequired') }}
      </p>
      <label class="field">
        <span class="field-label">{{ t('approvals.provider') }}</span>
        <select
          class="field-input"
          data-testid="destination-provider"
          :value="provider"
          :disabled="disabled"
          @change="onProviderChange"
        >
          <option value="openproject">{{ t('approvals.openproject') }}</option>
          <option value="redmine">{{ t('approvals.redmine') }}</option>
        </select>
      </label>
      <label class="field">
        <span class="field-label">{{ t('approvals.destinationUrl') }}</span>
        <input
          class="field-input"
          data-testid="destination-url"
          :value="destinationUrl"
          :disabled="disabled"
          :aria-invalid="!!errorKey"
          aria-describedby="destination-url-help destination-url-error"
          autocomplete="off"
          @input="onUrlInput"
        />
      </label>
      <p id="destination-url-help" class="empty">{{ t('approvals.destinationHelp') }}</p>
      <p id="destination-url-error" class="empty" role="alert">
        <span v-if="errorKey">{{ t(errorKey) }}</span>
      </p>
      <p v-if="httpWarning" class="warning" data-testid="http-warning" role="status">
        {{ t('approvals.httpWarning') }}
      </p>
      <button class="button" data-testid="add-destination" type="submit" :disabled="!canAdd">
        {{ t('approvals.addDestination') }}
      </button>
    </form>
    <p v-if="empty" class="empty">{{ t('approvals.noDestinations') }}</p>
    <ul v-else class="list">
      <li v-for="item in destinations" :key="destinationKey(item)" class="list-item">
        <span>{{ destinationLabel(item) }}</span>
        <span v-if="missingOrigins.includes(item.websiteOrigin)">
          {{ t('approvals.websitePermissionMissing') }}
        </span>
        <span v-if="missingOrigins.includes(item.origin)">
          {{ t('approvals.permissionMissing') }}
        </span>
        <button
          v-if="missingOrigins.includes(item.origin)"
          type="button"
          :disabled="disabled"
          :aria-label="`${t('approvals.restorePermission')} ${destinationLabel(item)}`"
          :data-testid="`restore-destination-${destinationKey(item)}`"
          @click="emit('restore', item)"
        >
          {{ t('approvals.restorePermission') }}
        </button>
        <button
          class="button-link"
          type="button"
          :disabled="disabled"
          :data-testid="`revoke-destination-${destinationKey(item)}`"
          :aria-label="`${t('approvals.revokeDestination')} ${destinationLabel(item)}`"
          @click="emit('revoke', item)"
        >
          {{ t('approvals.revokeDestination') }}
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.panel {
  display: grid;
  gap: 0.75rem;
}
.panel-title {
  font-size: 1rem;
  margin: 0;
}
.form,
.list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.field {
  display: grid;
  gap: 0.25rem;
}
.field-input,
.button,
.button-link {
  font: inherit;
}
.list-item {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}
.warning,
.empty {
  margin: 0;
}
</style>
