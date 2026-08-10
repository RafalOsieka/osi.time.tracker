<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { NavigationMenuItem } from '@nuxt/ui';

const { t } = useI18n();
const route = useRoute();

const props = withDefaults(defineProps<{ collapsed?: boolean; iconOnly?: boolean }>(), {
  collapsed: false,
  iconOnly: false,
});

const isCollapsed = computed(() => props.collapsed || props.iconOnly);

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
      :items="navItems"
      orientation="vertical"
      class="w-full"
    />
  </nav>
</template>
