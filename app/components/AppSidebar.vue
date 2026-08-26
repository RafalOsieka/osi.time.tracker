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
    to: '/reports',
    icon: 'i-lucide-chart-column',
    active: route.path.startsWith('/reports'),
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
      :items="navItems"
      orientation="vertical"
      class="w-full"
    />
  </nav>
</template>
