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
    // Custom attrs for stable e2e/nuxt selectors
    ui: undefined,
  },
  {
    label: t('nav.clients'),
    to: '/clients',
    icon: 'i-lucide-users',
    active: route.path.startsWith('/clients'),
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
  <nav aria-label="Main navigation" data-testid="app-sidebar" class="w-full">
    <UNavigationMenu
      :collapsed="isCollapsed"
      :items="navItems"
      orientation="vertical"
      class="w-full"
    >
      <template #item="{ item }">
        <!-- Content only: UNavigationMenu already renders the link from item.to -->
        <span
          class="flex items-center gap-2 w-full"
          :data-testid="`nav-link-${String(item.to === '/' ? 'timer' : String(item.to).replace(/^\//, ''))}`"
        >
          <UIcon v-if="item.icon" :name="String(item.icon)" class="size-5 shrink-0" />
          <span v-if="!isCollapsed">{{ item.label }}</span>
        </span>
      </template>
    </UNavigationMenu>
  </nav>
</template>
