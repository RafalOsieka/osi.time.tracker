<script setup lang="ts">
import { computed } from 'vue';
import type { WebsiteApproval } from '../approvals/approvals.js';
import { useExtensionI18n } from '../composables/use-extension-i18n.js';

const { websites, origin } = defineProps<{
  websites: readonly WebsiteApproval[];
  origin: string;
}>();

const emit = defineEmits<{
  'update:origin': [value: string];
  add: [];
  revoke: [origin: string];
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
          autocomplete="off"
          @input="onOriginInput"
        />
      </label>
      <button class="button" data-testid="add-website" type="submit">
        {{ t('approvals.addWebsite') }}
      </button>
    </form>
    <p v-if="empty" class="empty">{{ t('approvals.noWebsites') }}</p>
    <ul v-else class="list">
      <li v-for="website in websites" :key="website.origin" class="list-item">
        <span>{{ website.origin }}</span>
        <button
          class="button-link"
          type="button"
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
