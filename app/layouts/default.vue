<script setup lang="ts">
const { railMode, toggle } = useShellState();

// Drawer state for < lg viewports
const drawerOpen = ref(false);
const timerPlaceholderText = 'TIMER PLACEHOLDER';

function openDrawer() {
  drawerOpen.value = true;
}

function closeDrawer() {
  drawerOpen.value = false;
  nextTick(() => {
    const btn = document.querySelector<HTMLElement>('[data-testid="sidebar-toggle"]');
    btn?.focus();
  });
}

function onToggleSidebar() {
  // On desktop (lg+) toggle rail; on mobile open drawer
  if (window.matchMedia('(min-width: 1024px)').matches) {
    toggle();
  } else {
    openDrawer();
  }
}
</script>

<template>
  <div class="app-shell">
    <!-- Top bar -->
    <AppTopBar :sidebar-open="drawerOpen || railMode === 'full'" @toggle-sidebar="onToggleSidebar">
      <template #timer>
        <div class="app-shell__timer-inline" data-testid="timer-region-inline">
          {{ timerPlaceholderText }}
        </div>
      </template>
      <template #utility>
        <AppUtilityMenu />
      </template>
    </AppTopBar>

    <!-- Very-small stacked timer row (shown below timer-stack breakpoint) -->
    <div class="app-shell__timer-row" data-testid="timer-region-stacked">
      {{ timerPlaceholderText }}
    </div>

    <div class="app-shell__body">
      <!-- Desktop static rail (>= lg) -->
      <aside
        class="app-shell__rail"
        :class="{ 'app-shell__rail--icon-only': railMode === 'icon-only' }"
        data-testid="app-rail"
      >
        <AppSidebar :icon-only="railMode === 'icon-only'" />
      </aside>

      <!-- Mobile off-canvas drawer (< lg) -->
      <Drawer
        v-model:visible="drawerOpen"
        position="left"
        :modal="true"
        :dismissable="true"
        :show-close-icon="true"
        class="app-shell__drawer"
        data-testid="app-drawer"
        @hide="closeDrawer"
      >
        <AppSidebar />
      </Drawer>

      <!-- Page content -->
      <main class="app-shell__content" data-testid="app-content">
        <NuxtPage />
      </main>

      <Toast />
    </div>
  </div>
</template>

<style>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--p-content-background);
  color: var(--p-text-color);
}

/* Very-small stacked timer row: hidden by default, shown below breakpoint */
.app-shell__timer-row {
  display: none;
  width: 100%;
  min-height: 2.5rem;
  border-bottom: 1px solid var(--p-content-border-color);
  background-color: var(--p-content-background);
}

@media (max-width: 480px) {
  .app-shell__timer-row {
    display: flex;
    align-items: center;
    padding: 0 1rem;
  }

  /* Hide inline timer region on very-small viewports */
  .app-shell__timer-inline {
    display: none;
  }
}

.app-shell__body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Desktop rail: visible >= lg (1024px) */
.app-shell__rail {
  display: none;
  flex-shrink: 0;
  width: 16rem;
  border-right: 1px solid var(--p-content-border-color);
  background-color: var(--p-content-background);
  overflow: hidden;
  transition: width 0.2s ease;
}

.app-shell__rail--icon-only {
  width: 3.25rem;
}

@media (min-width: 1024px) {
  .app-shell__rail {
    display: flex;
    flex-direction: column;
  }
}

.app-shell__content {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}

@media (max-width: 480px) {
  .app-shell__drawer {
    --p-drawer-header-padding: 0.25rem 0.5rem;
  }
}
</style>
