<script setup lang="ts">
import { computed } from 'vue';
import type { WebsiteApproval } from '../approvals/approvals.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';

const { websites, origin, disabled, errorKey, missingOrigins } = defineProps<{
  websites: readonly WebsiteApproval[];
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

function onOriginInput(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLInputElement) emit('update:origin', target.value);
}

function onAdd(event: Event): void {
  event.preventDefault();
  emit('add');
}
</script>

<template>
  <section class="panel" aria-labelledby="websites-title">
    <h2 id="websites-title" class="panel-title">{{ t('approvals.websitesTitle') }}</h2>
    <form class="form" @submit="onAdd">
      <label class="field">
        <span class="field-label">{{ t('approvals.websiteOrigin') }}</span>
        <input
          class="field-input"
          data-testid="website-origin"
          :value="origin"
          :disabled="disabled"
          :aria-invalid="!!errorKey"
          aria-describedby="website-origin-help website-origin-error"
          autocomplete="off"
          @input="onOriginInput"
        />
      </label>
      <p id="website-origin-help" class="empty">{{ t('approvals.websiteHelp') }}</p>
      <p id="website-origin-error" class="empty" role="alert">
        <span v-if="errorKey">{{ t(errorKey) }}</span>
      </p>
      <button class="button" data-testid="add-website" type="submit" :disabled="disabled">
        {{ t('approvals.addWebsite') }}
      </button>
    </form>
    <p v-if="empty" class="empty">{{ t('approvals.noWebsites') }}</p>
    <ul v-else class="list">
      <li v-for="website in websites" :key="website.origin" class="list-item">
        <span>{{ website.origin }}</span>
        <span v-if="missingOrigins.includes(website.origin)">
          {{ t('approvals.permissionMissing') }}
        </span>
        <button
          v-if="missingOrigins.includes(website.origin)"
          type="button"
          :disabled="disabled"
          :aria-label="`${t('approvals.restorePermission')} ${website.origin}`"
          :data-testid="`restore-website-${website.origin}`"
          @click="emit('restore', website.origin)"
        >
          {{ t('approvals.restorePermission') }}
        </button>
        <button
          class="button-link"
          type="button"
          :disabled="disabled"
          :data-testid="`revoke-website-${website.origin}`"
          :aria-label="`${t('approvals.revokeWebsite')} ${website.origin}`"
          @click="emit('revoke', website.origin)"
        >
          {{ t('approvals.revokeWebsite') }}
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
.empty {
  margin: 0;
}
</style>
