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
      'hidden lg:flex flex-col shrink-0 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 overflow-hidden',
      layout.sidebarCollapsed ? 'w-14' : 'w-56',
    ]"
  >
    <!-- Logo -->
    <div class="flex items-center gap-3 px-3 py-4 shrink-0">
      <div class="bg-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
        <i class="pi pi-clock text-primary-contrast text-lg"></i>
      </div>
      <span v-show="!layout.sidebarCollapsed" class="font-bold text-slate-900 dark:text-white whitespace-nowrap">
        Osi Time Tracker
      </span>
    </div>

    <!-- Nav links -->
    <nav class="flex flex-col gap-1 px-2 flex-1">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-2 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        active-class="bg-primary/10 text-primary font-semibold"
      >
        <i :class="[item.icon, 'text-lg shrink-0']"></i>
        <span v-show="!layout.sidebarCollapsed" class="whitespace-nowrap">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- Collapse toggle -->
    <div class="px-2 py-3 shrink-0">
      <button
        class="flex w-full items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        :title="layout.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="layout.toggleSidebar()"
      >
        <i :class="layout.sidebarCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"></i>
      </button>
    </div>
  </aside>

  <!-- Mobile top bar -->
  <div class="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0">
    <button
      class="flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      title="Open menu"
      @click="mobileOpen = true"
    >
      <i class="pi pi-bars text-lg"></i>
    </button>
    <div class="bg-primary flex h-8 w-8 items-center justify-center rounded-xl">
      <i class="pi pi-clock text-primary-contrast"></i>
    </div>
    <span class="font-bold text-slate-900 dark:text-white">Osi Time Tracker</span>
  </div>

  <!-- Mobile drawer -->
  <Drawer v-model:visible="mobileOpen" position="left" :pt="{ root: 'w-56' }">
    <template #header>
      <div class="flex items-center gap-3">
        <div class="bg-primary flex h-8 w-8 items-center justify-center rounded-xl">
          <i class="pi pi-clock text-primary-contrast"></i>
        </div>
        <span class="font-bold text-slate-900 dark:text-white">Osi Time Tracker</span>
      </div>
    </template>
    <nav class="flex flex-col gap-1">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 rounded-lg px-2 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        active-class="bg-primary/10 text-primary font-semibold"
        @click="closeMobile"
      >
        <i :class="[item.icon, 'text-lg shrink-0']"></i>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </Drawer>
</template>
