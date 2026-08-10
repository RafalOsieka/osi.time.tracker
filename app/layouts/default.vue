<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { sidebarToggleProps } from '~/utils/sidebarToggleProps';

const { t } = useI18n();
const { fetchRunning } = useTimer();

// Collapse is owned + cookie-persisted by UDashboardGroup/UDashboardSidebar (storage-key).
// Keep a local v-model only for aria-expanded and slot bindings; Nuxt UI hydrates it from storage.
const collapsed = ref(false);
const open = ref(false);
const sidebarToggle = sidebarToggleProps();

onMounted(() => {
  fetchRunning().catch(() => {
    // Best-effort: a failed initial fetch just leaves the timer idle.
  });
});
</script>

<template>
  <UDashboardGroup unit="rem" storage="cookie" storage-key="osi-dashboard" class="min-h-screen">
    <UDashboardSidebar
      id="osi-sidebar"
      v-model:collapsed="collapsed"
      v-model:open="open"
      collapsible
      :default-size="16"
      :min-size="12"
      :max-size="20"
      :collapsed-size="4"
      :toggle="sidebarToggle"
      data-testid="app-sidebar"
    >
      <template #header="{ collapsed: isCollapsed }">
        <div class="flex items-center gap-2 px-2 py-1" data-testid="app-sidebar-brand">
          <span v-if="!isCollapsed" class="truncate font-semibold">{{ t('layout.title') }}</span>
        </div>
      </template>

      <template #default="{ collapsed: isCollapsed }">
        <AppSidebar :collapsed="isCollapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel data-testid="app-content">
      <template #header>
        <!--
          Center is `hidden lg:flex` in Nuxt UI by default; override so the timer stays
          visible at every breakpoint. Toggle is mobile-only (`lg:hidden` on the control).
        -->
        <UDashboardNavbar
          data-testid="app-topbar"
          :toggle="sidebarToggle"
          :ui="{
            root: 'min-h-(--ui-header-height) h-auto py-2',
            center: 'flex flex-1 justify-center min-w-0 px-2',
            left: 'flex items-center gap-1.5 shrink-0',
            right: 'flex items-center shrink-0 gap-1.5',
          }"
        >
          <div
            class="flex w-full max-w-3xl min-w-0 items-center justify-center"
            data-testid="timer-region"
          >
            <div class="w-full min-w-0" data-testid="timer-region-inline">
              <AppTimer />
            </div>
          </div>

          <template #right>
            <AppUtilityMenu />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="p-4">
          <NuxtPage />
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
