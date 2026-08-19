<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { sidebarToggleProps } from '~/utils/sidebarToggleProps';
import type { TimeEntryDto } from '../../shared/types/time-entry';

const { t } = useI18n();
const { seedRunning, resumeTickerIfNeeded } = useTimer();

// Forwards the incoming request cookies during SSR so the running entry is
// authenticated the same way as browser navigations (plain $fetch is not).
const requestFetch = useRequestFetch();

const { data: runningData } = await useAsyncData('timer-running', () =>
  requestFetch<TimeEntryDto | null>('/api/time-entries/running').catch(() => null),
);

// Seed shared timer state for first paint (running title/mode). Elapsed stays
// zero until the client ticker starts after hydrate.
seedRunning(runningData.value ?? null);

// Collapse is owned + cookie-persisted by UDashboardGroup/UDashboardSidebar (storage-key).
// Keep a local v-model only for aria-expanded and slot bindings; Nuxt UI hydrates it from storage.
const collapsed = ref(false);
const open = ref(false);
const sidebarToggle = sidebarToggleProps();

onMounted(() => {
  resumeTickerIfNeeded();
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
        <div
          class="flex w-full min-w-0 items-center py-1"
          :class="isCollapsed ? 'justify-center px-0' : 'gap-2 px-2'"
          data-testid="app-sidebar-brand"
        >
          <AppBrandMark :collapsed="isCollapsed" />
          <span v-if="!isCollapsed" class="truncate font-semibold">{{ t('layout.title') }}</span>
        </div>
      </template>

      <template #default="{ collapsed: isCollapsed }">
        <AppSidebar :collapsed="isCollapsed" />
      </template>

      <template #footer="{ collapsed: isCollapsed }">
        <AppUserFooter :collapsed="isCollapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardPanel data-testid="app-content">
      <template #header>
        <!--
          Center is `hidden lg:flex` in Nuxt UI by default; override so the timer stays
          visible at every breakpoint. Mobile toggle is lg:hidden; desktop collapse is
          hidden lg:flex (via UDashboardSidebarCollapse theme).
        -->
        <UDashboardNavbar
          data-testid="app-topbar"
          :toggle="sidebarToggle"
          :ui="{
            root: 'min-h-(--ui-header-height) h-auto py-2',
            center: 'flex flex-1 min-w-0 px-2',
            left: 'flex items-center gap-1.5 shrink-0',
            right: 'flex items-center shrink-0 gap-1.5',
          }"
        >
          <template #left>
            <UDashboardSidebarCollapse v-bind="sidebarToggle" data-testid="sidebar-collapse" />
          </template>

          <div class="flex w-full min-w-0 items-center" data-testid="timer-region">
            <div class="w-full min-w-0" data-testid="timer-region-inline">
              <AppTimer />
            </div>
          </div>
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
