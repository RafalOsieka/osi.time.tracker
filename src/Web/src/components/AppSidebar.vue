<script lang="ts" setup>
import Drawer from 'primevue/drawer';
import { ref } from 'vue';
import { RouterLink } from 'vue-router';

import { useLayoutStore } from '../stores/layout';

const layout = useLayoutStore();

const mobileOpen = ref(false);

const navItems = [
  { to: '/tracker', icon: 'pi pi-clock', label: 'Tracker' },
  { to: '/reports', icon: 'pi pi-chart-bar', label: 'Reports' },
  { to: '/publish', icon: 'pi pi-send', label: 'Publish' },
  { to: '/settings', icon: 'pi pi-cog', label: 'Settings' },
];

function closeMobile() {
  mobileOpen.value = false;
}
</script>

<template>
  <!-- Desktop sidebar -->
  <aside
    :class="[
      'hidden lg:flex flex-col shrink-0 h-screen border-r transition-all duration-300 overflow-hidden',
      layout.sidebarCollapsed ? 'w-14' : 'w-56',
    ]"
    style="background-color: var(--ds-bg-surface); border-color: var(--ds-border)"
  >
    <!-- Logo -->
    <div class="flex items-center gap-3 px-3 py-4 shrink-0">
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style="background-color: var(--ds-accent)">
        <i class="pi pi-clock text-white text-lg"></i>
      </div>
      <span v-show="!layout.sidebarCollapsed" class="font-bold whitespace-nowrap" style="color: var(--ds-text-hi)">
        Osi Time Tracker
      </span>
    </div>

    <!-- Nav links -->
    <nav class="flex flex-col gap-1 px-2 flex-1">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="ds-nav-item flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
        active-class="ds-nav-item--active"
        style="color: var(--ds-text-lo)"
      >
        <i :class="[item.icon, 'text-lg shrink-0']"></i>
        <span v-show="!layout.sidebarCollapsed" class="whitespace-nowrap">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- Collapse toggle -->
    <div class="px-2 py-3 shrink-0">
      <button
        class="flex w-full items-center justify-center rounded-lg p-2 transition-colors ds-nav-item"
        :title="layout.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        style="color: var(--ds-text-lo)"
        @click="layout.toggleSidebar()"
      >
        <i :class="layout.sidebarCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"></i>
        <span v-show="!layout.sidebarCollapsed" class="ml-2 text-sm whitespace-nowrap">Collapse</span>
      </button>
    </div>
  </aside>

  <!-- Mobile top bar -->
  <div class="lg:hidden flex items-center gap-3 px-4 py-3 border-b shrink-0" style="background-color: var(--ds-bg-surface); border-color: var(--ds-border)">
    <button
      class="flex items-center justify-center rounded-lg p-2 transition-colors ds-nav-item"
      title="Open menu"
      style="color: var(--ds-text-lo)"
      @click="mobileOpen = true"
    >
      <i class="pi pi-bars text-lg"></i>
    </button>
    <div class="flex h-8 w-8 items-center justify-center rounded-xl" style="background-color: var(--ds-accent)">
      <i class="pi pi-clock text-white"></i>
    </div>
    <span class="font-bold" style="color: var(--ds-text-hi)">Osi Time Tracker</span>
  </div>

  <!-- Mobile drawer -->
  <Drawer v-model:visible="mobileOpen" position="left" :pt="{ root: 'w-56' }">
    <template #header>
      <div class="flex items-center gap-3">
        <div class="flex h-8 w-8 items-center justify-center rounded-xl" style="background-color: var(--ds-accent)">
          <i class="pi pi-clock text-white"></i>
        </div>
        <span class="font-bold" style="color: var(--ds-text-hi)">Osi Time Tracker</span>
      </div>
    </template>
    <nav class="flex flex-col gap-1">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="ds-nav-item flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
        active-class="ds-nav-item--active"
        style="color: var(--ds-text-lo)"
        @click="closeMobile"
      >
        <i :class="[item.icon, 'text-lg shrink-0']"></i>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </Drawer>
</template>
