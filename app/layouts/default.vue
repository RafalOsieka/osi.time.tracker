<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { fetchRunning } = useTimer();
const { railMode, setMode } = useShellState();

const collapsed = computed({
  get: () => railMode.value === 'icon-only',
  set: (value: boolean) => setMode(value ? 'icon-only' : 'full'),
});

const open = ref(false);
// Cast: Nuxt UI ButtonProps omit some HTML attrs we still want to pass through at runtime.
const sidebarToggle = { color: 'neutral', variant: 'ghost' } as Record<string, unknown>;

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
      data-testid="app-rail"
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
        <UDashboardNavbar data-testid="app-topbar">
          <template #leading>
            <UDashboardSidebarToggle
              data-testid="sidebar-toggle"
              :aria-label="t('layout.title')"
              :aria-expanded="open || !collapsed"
            />
          </template>

          <template #right>
            <AppUtilityMenu />
          </template>
        </UDashboardNavbar>

        <!-- Single AppTimer instance: full-width under the navbar (works at all breakpoints). -->
        <div
          class="flex w-full items-center border-b border-default px-4 py-2"
          data-testid="timer-region"
        >
          <div class="w-full min-[481px]:max-w-3xl" data-testid="timer-region-inline">
            <AppTimer />
          </div>
        </div>
        <div class="hidden" data-testid="timer-region-stacked" aria-hidden="true" />
      </template>

      <template #body>
        <div class="p-4">
          <NuxtPage />
        </div>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
