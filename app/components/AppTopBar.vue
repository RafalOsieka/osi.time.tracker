<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  sidebarOpen: boolean;
}>();

const emit = defineEmits<{
  toggleSidebar: [];
}>();
</script>

<template>
  <Toolbar class="app-topbar" data-testid="app-topbar">
    <template #start>
      <Button
        icon="pi pi-bars"
        severity="secondary"
        text
        :aria-label="t('layout.title')"
        :aria-expanded="props.sidebarOpen"
        data-testid="sidebar-toggle"
        @click="emit('toggleSidebar')"
      />
    </template>

    <!-- Reserved timer region slot -->
    <template #center>
      <div data-testid="timer-region">
        <slot name="timer" />
      </div>
    </template>

    <template #end>
      <slot name="utility" />
    </template>
  </Toolbar>
</template>

<style>
.app-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
}

@media (max-width: 480px) {
  .app-topbar {
    --p-toolbar-padding: 0.25rem 0.5rem;
  }
}
</style>
