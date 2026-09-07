<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const { t } = useI18n();
const route = useRoute();

const { collapsed = false, iconOnly = false } = defineProps<{
  collapsed?: boolean;
  iconOnly?: boolean;
}>();

const isCollapsed = computed(() => collapsed || iconOnly);

const navItems = computed<NavigationMenuItem[]>(() => [
  {
    label: t('nav.timer'),
    to: '/',
    icon: 'i-lucide-timer',
    active: route.path === '/',
    exact: true,
  },
  {
    label: t('nav.trackers'),
    to: '/trackers',
    icon: 'i-lucide-cable',
    active: route.path.startsWith('/trackers'),
  },
  {
    label: t('nav.projects'),
    to: '/projects',
    icon: 'i-lucide-briefcase',
    active: route.path.startsWith('/projects'),
  },
  {
    label: t('nav.reports'),
    icon: 'i-lucide-chart-column',
    type: 'trigger',
    open: true,
    defaultOpen: true,
    active: false,
    children: [
      {
        label: t('reports.monthly.pageTitle'),
        to: '/reports/monthly',
        icon: 'i-lucide-calendar-days',
        active: route.path.startsWith('/reports/monthly'),
      },
    ],
  },
  {
    label: t('nav.settings'),
    to: '/settings',
    icon: 'i-lucide-settings',
    active: route.path.startsWith('/settings'),
  },
]);
</script>

<template>
  <nav aria-label="Main navigation" class="w-full">
    <UNavigationMenu
      :collapsed="isCollapsed"
      :tooltip="isCollapsed"
      :popover="isCollapsed"
      :items="navItems"
      orientation="vertical"
      class="w-full"
    />
  </nav>
</template>
